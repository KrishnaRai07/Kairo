import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMonthlyFlowTrend,
  computeYearlyFlowTrend,
} from '../src/services/analyticsService';
import { Task } from '../src/types/task';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't-1',
  title: 'Deep Work',
  startTime: '2026-11-10T09:00:00.000Z',
  endTime: '2026-11-10T10:00:00.000Z',
  status: 'completed',
  priority: 'high',
  createdAt: '2026-11-10T08:00:00.000Z',
  completedAt: '2026-11-10T09:50:00.000Z',
  ...overrides,
});

test('1. computeMonthlyFlowTrend: generates correct day count for November (30 days)', () => {
  const tasks: Task[] = [];
  const result = computeMonthlyFlowTrend(tasks, [], 2026, 10); // 10 is November

  assert.equal(result.year, 2026);
  assert.equal(result.month, 10);
  assert.equal(result.monthName, 'November 2026');
  assert.equal(result.days.length, 30);
  assert.equal(result.days[0].dayNumber, 1);
  assert.equal(result.days[29].dayNumber, 30);
  assert.equal(result.averageScore, 0);
  assert.equal(result.activeDays, 0);
});

test('2. computeMonthlyFlowTrend: calculates daily flow score, peak day, and mastery days', () => {
  const tasks: Task[] = [
    // Day 10: 2 tasks completed on time -> High Flow score
    createMockTask({
      id: 'd10-1',
      startTime: '2026-11-10T09:00:00.000Z',
      endTime: '2026-11-10T10:00:00.000Z',
      status: 'completed',
      completedAt: '2026-11-10T09:45:00.000Z',
    }),
    createMockTask({
      id: 'd10-2',
      startTime: '2026-11-10T10:30:00.000Z',
      endTime: '2026-11-10T11:30:00.000Z',
      status: 'completed',
      completedAt: '2026-11-10T11:20:00.000Z',
    }),
    // Day 15: 1 task missed
    createMockTask({
      id: 'd15-1',
      startTime: '2026-11-15T14:00:00.000Z',
      endTime: '2026-11-15T15:00:00.000Z',
      status: 'missed',
      completedAt: null,
    }),
  ];

  const result = computeMonthlyFlowTrend(tasks, [], 2026, 10);

  assert.equal(result.activeDays, 2);
  const day10 = result.days.find((d) => d.dayNumber === 10);
  const day15 = result.days.find((d) => d.dayNumber === 15);
  const day20 = result.days.find((d) => d.dayNumber === 20);

  assert.ok(day10?.hasActivity);
  assert.ok(day10!.score >= 80, `Day 10 score ${day10!.score} should be >= 80`);
  assert.equal(day10?.plannedTasks, 2);
  assert.equal(day10?.completedTasks, 2);

  assert.ok(day15?.hasActivity);
  assert.ok(day15!.score < day10!.score, 'Day 15 missed task should have lower score');

  assert.equal(day20?.hasActivity, false);
  assert.equal(day20?.score, 0);

  assert.ok(result.peakScore >= 80);
  assert.ok(result.masteryDays >= 1);
  assert.ok(result.averageScore > 0);
});

test('3. computeYearlyFlowTrend: generates 12 calendar months and annual metrics', () => {
  const tasks: Task[] = [
    // Month 10 (November): active tasks
    createMockTask({
      id: 'nov-1',
      startTime: '2026-11-05T09:00:00.000Z',
      endTime: '2026-11-05T10:00:00.000Z',
      status: 'completed',
    }),
    // Month 11 (December): active tasks
    createMockTask({
      id: 'dec-1',
      startTime: '2026-12-05T09:00:00.000Z',
      endTime: '2026-12-05T10:00:00.000Z',
      status: 'completed',
    }),
  ];

  const yearly = computeYearlyFlowTrend(tasks, [], 2026);

  assert.equal(yearly.year, 2026);
  assert.equal(yearly.months.length, 12);
  assert.equal(yearly.months[0].monthLabel, 'Jan');
  assert.equal(yearly.months[10].monthLabel, 'Nov');
  assert.equal(yearly.months[11].monthLabel, 'Dec');

  assert.equal(yearly.activeMonths, 2);
  assert.ok(yearly.months[10].hasActivity);
  assert.ok(yearly.months[11].hasActivity);
  assert.equal(yearly.months[0].hasActivity, false);

  assert.ok(yearly.annualAverage > 0);
  assert.ok(yearly.bestMonth.includes('Nov') || yearly.bestMonth.includes('Dec'));
});
