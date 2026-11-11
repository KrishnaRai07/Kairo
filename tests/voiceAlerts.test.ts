import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeTitleForSpeech,
  buildVoiceScript,
  getVoiceAlertKey,
  findDueVoiceAlerts,
} from '../src/services/voicePlanner';
import { DEFAULT_USER_SETTINGS, Task, UserSettings } from '../src/types/task';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-v1',
  title: 'System Architecture Review',
  startTime: '2026-11-10T10:00:00.000Z',
  endTime: '2026-11-10T11:00:00.000Z',
  status: 'upcoming',
  priority: 'high',
  createdAt: '2026-11-10T08:00:00.000Z',
  ...overrides,
});

test('1. sanitizeTitleForSpeech: strips [Day X/Y] milestone prefix smoothly', () => {
  assert.equal(sanitizeTitleForSpeech('[Day 5/30] Morning Coding'), 'Morning Coding');
  assert.equal(sanitizeTitleForSpeech('Client Sync'), 'Client Sync');
});

test('2. buildVoiceScript: crafts respectful 15min_before and at_start scripts with salutation', () => {
  const s15 = buildVoiceScript('Deep Work', '15min_before', 'Sir');
  assert.ok(s15.includes('Sir, 15 minute baad aapka Deep Work schedule hai'));

  const sStart = buildVoiceScript('[Day 2/30] DSA Practice', 'at_start', 'Krishna');
  assert.ok(sStart.includes('Krishna, aapke task DSA Practice ka samay ho gaya hai'));
});

test('3. findDueVoiceAlerts: triggers 15min_before alert inside due window and prevents duplicates', () => {
  const task = createTask({
    startTime: '2026-11-10T10:00:00.000Z',
    endTime: '2026-11-10T11:00:00.000Z',
  });
  const spoken = new Set<string>();

  // 09:45:10 AM (10s past the 15-min mark)
  const refTime = new Date('2026-11-10T09:45:10.000Z');
  const due1 = findDueVoiceAlerts([task], refTime, spoken, DEFAULT_USER_SETTINGS);

  assert.equal(due1.length, 1);
  assert.equal(due1[0].triggerType, '15min_before');

  // Mark as spoken and re-evaluate 20s later -> should NOT repeat
  spoken.add(due1[0].alertKey);
  const due2 = findDueVoiceAlerts([task], new Date('2026-11-10T09:45:30.000Z'), spoken, DEFAULT_USER_SETTINGS);
  assert.equal(due2.length, 0);
});

test('4. findDueVoiceAlerts: triggers at_start alert and ignores completed/skipped/disabled', () => {
  const task = createTask({
    id: 'task-v2',
    startTime: '2026-11-10T12:00:00.000Z',
    endTime: '2026-11-10T12:45:00.000Z',
    status: 'in_progress',
  });
  const spoken = new Set<string>();

  const due = findDueVoiceAlerts([task], new Date('2026-11-10T12:00:15.000Z'), spoken, DEFAULT_USER_SETTINGS);
  assert.equal(due.length, 1);
  assert.equal(due[0].triggerType, 'at_start');

  // Disabled voice alerts returns []
  const mutedSettings: UserSettings = { ...DEFAULT_USER_SETTINGS, enableVoiceAlerts: false };
  assert.deepEqual(findDueVoiceAlerts([task], new Date('2026-11-10T12:00:15.000Z'), spoken, mutedSettings), []);

  // Completed task returns []
  const doneTask: Task = { ...task, status: 'completed' };
  assert.deepEqual(findDueVoiceAlerts([doneTask], new Date('2026-11-10T12:00:15.000Z'), spoken, DEFAULT_USER_SETTINGS), []);
});

test('5. findDueVoiceAlerts: skips 15min alert for short <15m tasks and creates unique key on reschedule', () => {
  const microTask = createTask({
    id: 'micro',
    startTime: '2026-11-10T14:00:00.000Z',
    endTime: '2026-11-10T14:10:00.000Z', // 10 min duration
  });
  const spoken = new Set<string>();

  const dueBefore = findDueVoiceAlerts([microTask], new Date('2026-11-10T13:45:05.000Z'), spoken, DEFAULT_USER_SETTINGS);
  assert.equal(dueBefore.length, 0);

  // Rescheduling changes startTime and produces a brand new alert key
  const keyOld = getVoiceAlertKey('t1', '15min_before', '2026-11-10T10:00:00.000Z');
  const keyNew = getVoiceAlertKey('t1', '15min_before', '2026-11-10T16:00:00.000Z');
  assert.notEqual(keyOld, keyNew);
});

