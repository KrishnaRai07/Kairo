import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  SECURITY_QUESTIONS,
  validateCredential,
  normalizeSecurityAnswer,
  validateSecurityAnswers,
  shouldLockAfterBackground,
  buildLockConfigPayload,
  verifyCredentialAgainstPayload,
  verifyRecoveryAnswersAgainstPayload,
} from '../src/services/securityLogic';
import { SecurityAnswerInput } from '../src/types/task';

const nodeSha256 = async (input: string): Promise<string> =>
  crypto.createHash('sha256').update(input).digest('hex');

const validAnswers: SecurityAnswerInput[] = [
  { questionId: 'first_school', answer: 'Delhi Public School' },
  { questionId: 'best_friend', answer: 'Rohan Sharma' },
  { questionId: 'mothers_name', answer: 'Sunita' },
  { questionId: 'favorite_place', answer: 'Manali' },
  { questionId: 'favorite_person', answer: 'APJ Abdul Kalam' },
];

test('1. validateCredential: enforces exact rules for 4-PIN, 6-PIN, and 8+ Alphanumeric Password', () => {
  // 4-PIN
  assert.equal(validateCredential('pin4', '2580').valid, true);
  assert.equal(validateCredential('pin4', '123').valid, false);
  assert.equal(validateCredential('pin4', '12345').valid, false);
  assert.equal(validateCredential('pin4', '12a4').valid, false);

  // 6-PIN
  assert.equal(validateCredential('pin6', '987654').valid, true);
  assert.equal(validateCredential('pin6', '98765').valid, false);

  // Alphanumeric Password
  assert.equal(validateCredential('password', 'Kairo2026').valid, true);
  assert.equal(validateCredential('password', 'Pass12').valid, false); // <8 chars
  assert.equal(validateCredential('password', 'OnlyLettersHere').valid, false); // no digit
  assert.equal(validateCredential('password', '123456789').valid, false); // no letter
  assert.equal(validateCredential('password', 'Kairo 2026').valid, false); // whitespace
});

test('2. validateSecurityAnswers: requires all 5 questions answered cleanly', () => {
  assert.equal(SECURITY_QUESTIONS.length, 5);
  assert.equal(validateSecurityAnswers(validAnswers).valid, true);

  // Missing one question fails
  assert.equal(validateSecurityAnswers(validAnswers.slice(0, 4)).valid, false);

  // Too short / blank answer fails
  const bad = validAnswers.map((a, idx) =>
    idx === 2 ? { ...a, answer: '  A  ' } : a
  );
  assert.equal(validateSecurityAnswers(bad).valid, false);
});

test('3. Security Config Hashing & Verification: credential and case-insensitive 5-question recovery', async () => {
  const payload = await buildLockConfigPayload(
    'pin4',
    '4321',
    validAnswers,
    'random_salt_hex',
    nodeSha256
  );

  // Credential verification
  assert.equal(await verifyCredentialAgainstPayload('4321', payload, nodeSha256), true);
  assert.equal(await verifyCredentialAgainstPayload('1111', payload, nodeSha256), false);

  // Case-insensitive + extra spacing normalized recovery
  const messySubmittedAnswers: SecurityAnswerInput[] = [
    { questionId: 'first_school', answer: '  delhi   public school ' },
    { questionId: 'best_friend', answer: 'ROHAN SHARMA' },
    { questionId: 'mothers_name', answer: 'sunita' },
    { questionId: 'favorite_place', answer: ' manali' },
    { questionId: 'favorite_person', answer: 'apj abdul kalam ' },
  ];

  const recoveryOk = await verifyRecoveryAnswersAgainstPayload(
    messySubmittedAnswers,
    payload,
    nodeSha256
  );
  assert.equal(recoveryOk.verified, true);
  assert.equal(recoveryOk.matchedCount, 5);

  // Wrong 1 answer fails recovery cleanly
  const wrongSubmitted = messySubmittedAnswers.map((a) =>
    a.questionId === 'favorite_place' ? { ...a, answer: 'Goa' } : a
  );
  const recoveryFail = await verifyRecoveryAnswersAgainstPayload(
    wrongSubmitted,
    payload,
    nodeSha256
  );
  assert.equal(recoveryFail.verified, false);
  assert.equal(recoveryFail.matchedCount, 4);
});

test('4. normalizeSecurityAnswer & shouldLockAfterBackground grace period logic', () => {
  assert.equal(normalizeSecurityAnswer('  St.   Xavier  '), 'st. xavier');

  const bgTime = 1_000_000;
  // Immediate lock (0s grace)
  assert.equal(shouldLockAfterBackground(bgTime, bgTime + 500, 0), true);

  // 1-minute grace period (60s)
  assert.equal(shouldLockAfterBackground(bgTime, bgTime + 30_000, 60), false);
  assert.equal(shouldLockAfterBackground(bgTime, bgTime + 61_000, 60), true);

  // Null background timestamp
  assert.equal(shouldLockAfterBackground(null, bgTime + 90_000, 60), false);
});

