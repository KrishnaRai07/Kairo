import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskSchedule } from '../src/utils/dateUtils';

test('1. Valid schedule: Start before end within 24h returns valid', () => {
  const start = '2026-11-05T09:00:00.000Z';
  const end = '2026-11-05T10:00:00.000Z';
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
});

test('2. Invalid schedule: End time equal to start time is rejected', () => {
  const start = '2026-11-05T09:00:00.000Z';
  const end = '2026-11-05T09:00:00.000Z';
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /End time must be after start time/);
});

test('3. Invalid schedule: End time earlier than start time is rejected', () => {
  const start = '2026-11-05T10:00:00.000Z';
  const end = '2026-11-05T09:00:00.000Z';
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /End time must be after start time/);
});

test('4. Invalid schedule: Malformed or unparseable date string is rejected', () => {
  const start = 'not-a-date';
  const end = '2026-11-05T10:00:00.000Z';
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /Invalid date or time format/);
});

test('5. Invalid schedule: Duration exceeding 24 hours is rejected', () => {
  const start = '2026-11-05T09:00:00.000Z';
  const end = '2026-11-06T12:00:00.000Z'; // 27 hours
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /cannot exceed 24 hours/);
});

test('6. Valid schedule across midnight: 23:00 to 01:00 next day is valid', () => {
  const start = '2026-11-05T23:00:00.000Z';
  const end = '2026-11-06T01:00:00.000Z'; // 2 hours duration across midnight
  const result = validateTaskSchedule(start, end);

  assert.equal(result.isValid, true);
});

