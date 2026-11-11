import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime,
  formatDuration,
  isToday,
  isYesterday,
  isTomorrow,
  getWeekBoundaries,
  getMonthBoundaries,
  getRelativeDateLabel,
} from '../src/utils/dateUtils';

test('1. formatTime: supports 12-hour AM/PM format', () => {
  const morning = '2026-11-05T09:05:00.000';
  const evening = '2026-11-05T21:45:00.000';

  assert.equal(formatTime(morning, '12h'), '9:05 AM');
  assert.equal(formatTime(evening, '12h'), '9:45 PM');
});

test('2. formatTime: supports 24-hour format', () => {
  const morning = '2026-11-05T09:05:00.000';
  const evening = '2026-11-05T21:45:00.000';

  assert.equal(formatTime(morning, '24h'), '09:05');
  assert.equal(formatTime(evening, '24h'), '21:45');
});

test('3. formatDuration: handles minutes and hours properly', () => {
  const start = '2026-11-05T09:00:00.000Z';
  const end30 = '2026-11-05T09:30:00.000Z';
  const end90 = '2026-11-05T10:30:00.000Z';
  const end120 = '2026-11-05T11:00:00.000Z';

  assert.equal(formatDuration(start, end30), '30m');
  assert.equal(formatDuration(start, end90), '1h 30m');
  assert.equal(formatDuration(start, end120), '2h');
});

test('4. Relative date indicators: detects today, yesterday, tomorrow', () => {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  assert.equal(isToday(now), true);
  assert.equal(isYesterday(yesterday), true);
  assert.equal(isTomorrow(tomorrow), true);

  assert.equal(getRelativeDateLabel(now), 'Today');
  assert.equal(getRelativeDateLabel(yesterday), 'Yesterday');
  assert.equal(getRelativeDateLabel(tomorrow), 'Tomorrow');
});

test('5. getWeekBoundaries: produces 7 continuous days starting on Monday', () => {
  const midWeek = new Date('2026-11-04T12:00:00.000Z'); // Wednesday
  const { startOfWeek, endOfWeek, days } = getWeekBoundaries(midWeek);

  assert.equal(days.length, 7);
  // First day should be Monday
  assert.equal(days[0].getDay(), 1);
  // Last day should be Sunday
  assert.equal(days[6].getDay(), 0);

  const startMs = new Date(startOfWeek).getTime();
  const endMs = new Date(endOfWeek).getTime();
  assert.ok(endMs > startMs);
});

test('6. getMonthBoundaries: produces correct start and end of month', () => {
  const refDate = new Date(2026, 10, 15); // November 2026
  const { startOfMonth, endOfMonth } = getMonthBoundaries(refDate);

  const startD = new Date(startOfMonth);
  const endD = new Date(endOfMonth);

  assert.equal(startD.getDate(), 1);
  assert.equal(endD.getDate(), 30); // November has 30 days
});

