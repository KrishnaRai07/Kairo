import { LockType, SecurityQuestion, SecurityAnswerInput } from '../types/task';

export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  {
    id: 'first_school',
    question: 'What was the name of your first school?',
    placeholder: 'e.g., St. Xavier High School',
  },
  {
    id: 'best_friend',
    question: 'Who is your best friend or special someone?',
    placeholder: 'e.g., Aarav / Priya',
  },
  {
    id: 'mothers_name',
    question: "What is your mother's first name?",
    placeholder: 'e.g., Sunita',
  },
  {
    id: 'favorite_place',
    question: 'What is your favorite place or dream city?',
    placeholder: 'e.g., Manali / Tokyo',
  },
  {
    id: 'favorite_person',
    question: 'Who is your favorite person or role model?',
    placeholder: 'e.g., APJ Abdul Kalam',
  },
];

export interface LockConfigPayload {
  lockType: LockType;
  salt: string;
  credentialHash: string;
  answersHashMap: Record<string, string>; // questionId -> hash
  createdAt: string;
}

/**
 * Validates PIN or password format based on chosen lock type.
 */
export function validateCredential(
  lockType: LockType,
  value: string
): { valid: boolean; error?: string } {
  const clean = value.trim();

  if (lockType === 'pin4') {
    if (!/^\d{4}$/.test(clean)) {
      return { valid: false, error: '4-digit PIN must contain exactly 4 numeric digits (0–9).' };
    }
    return { valid: true };
  }

  if (lockType === 'pin6') {
    if (!/^\d{6}$/.test(clean)) {
      return { valid: false, error: '6-digit PIN must contain exactly 6 numeric digits (0–9).' };
    }
    return { valid: true };
  }

  // Alphanumeric Password: min 8 chars, at least 1 letter and 1 digit, no whitespace
  if (clean.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (/\s/.test(clean)) {
    return { valid: false, error: 'Password cannot contain spaces.' };
  }
  if (!/[A-Za-z]/.test(clean) || !/\d/.test(clean)) {
    return { valid: false, error: 'Password must include at least one letter and one number.' };
  }

  return { valid: true };
}

/**
 * Normalizes user answer for case-insensitive, space-tolerant verification.
 */
export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Ensures all 5 mandatory recovery questions have reasonable answers.
 */
export function validateSecurityAnswers(
  answers: SecurityAnswerInput[]
): { valid: boolean; error?: string } {
  if (!Array.isArray(answers) || answers.length !== SECURITY_QUESTIONS.length) {
    return {
      valid: false,
      error: `All ${SECURITY_QUESTIONS.length} security questions must be answered for account recovery.`,
    };
  }

  for (const q of SECURITY_QUESTIONS) {
    const found = answers.find((a) => a.questionId === q.id);
    if (!found || normalizeSecurityAnswer(found.answer).length < 2) {
      return {
        valid: false,
        error: `Please provide a valid answer for: "${q.question}"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Determines if the app should lock upon returning from background.
 * - If lockTimeoutSeconds === 0, locks immediately.
 * - If lastBackgroundAtMs is null (e.g. cold launch), caller handles cold launch lock.
 */
export function shouldLockAfterBackground(
  lastBackgroundAtMs: number | null,
  nowMs: number,
  lockTimeoutSeconds: number = 60
): boolean {
  if (lastBackgroundAtMs == null) {
    return false;
  }

  const elapsedMs = nowMs - lastBackgroundAtMs;
  return elapsedMs >= lockTimeoutSeconds * 1000;
}

export type HashFunction = (input: string) => Promise<string>;

/**
 * Pure async payload builder combining salt, hashed PIN/password, and hashed 5 security answers.
 */
export async function buildLockConfigPayload(
  lockType: LockType,
  credential: string,
  answers: SecurityAnswerInput[],
  salt: string,
  sha256: HashFunction,
  nowIso: string = new Date().toISOString()
): Promise<LockConfigPayload> {
  const credValidation = validateCredential(lockType, credential);
  if (!credValidation.valid) {
    throw new Error(credValidation.error || 'Invalid PIN or password.');
  }

  const ansValidation = validateSecurityAnswers(answers);
  if (!ansValidation.valid) {
    throw new Error(ansValidation.error || 'Incomplete security questions.');
  }

  const credentialHash = await sha256(`${salt}:cred:${credential.trim()}`);
  const answersHashMap: Record<string, string> = {};

  for (const q of SECURITY_QUESTIONS) {
    const found = answers.find((a) => a.questionId === q.id)!;
    const normalized = normalizeSecurityAnswer(found.answer);
    answersHashMap[q.id] = await sha256(`${salt}:q:${q.id}:${normalized}`);
  }

  return {
    lockType,
    salt,
    credentialHash,
    answersHashMap,
    createdAt: nowIso,
  };
}

/**
 * Verifies an input PIN or password against stored payload hash.
 */
export async function verifyCredentialAgainstPayload(
  inputCredential: string,
  payload: LockConfigPayload,
  sha256: HashFunction
): Promise<boolean> {
  if (!inputCredential || !payload?.salt || !payload?.credentialHash) {
    return false;
  }
  const candidateHash = await sha256(`${payload.salt}:cred:${inputCredential.trim()}`);
  return candidateHash === payload.credentialHash;
}

/**
 * Verifies all 5 security question answers against stored hashes.
 * Returns { verified, mismatchCount } so UI can provide clear non-leaking feedback.
 */
export async function verifyRecoveryAnswersAgainstPayload(
  answers: SecurityAnswerInput[],
  payload: LockConfigPayload,
  sha256: HashFunction
): Promise<{ verified: boolean; matchedCount: number }> {
  if (!payload?.salt || !payload?.answersHashMap) {
    return { verified: false, matchedCount: 0 };
  }

  let matchedCount = 0;

  for (const q of SECURITY_QUESTIONS) {
    const expectedHash = payload.answersHashMap[q.id];
    const submitted = answers.find((a) => a.questionId === q.id);
    if (!expectedHash || !submitted) continue;

    const normalized = normalizeSecurityAnswer(submitted.answer);
    const candidateHash = await sha256(`${payload.salt}:q:${q.id}:${normalized}`);
    if (candidateHash === expectedHash) {
      matchedCount += 1;
    }
  }

  return {
    verified: matchedCount === SECURITY_QUESTIONS.length,
    matchedCount,
  };
}

