import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDayMetrics,
  computeWeeklyTrend,
  computeMonthlyMetrics,
  computeResilienceMetrics,
  computeFocusTimeDistribution,
  computeActivityHeatmap,
} from '../src/services/analyticsService';
import { Task, TaskHistoryEvent } from '../src/types/task';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't-1',
  title: 'Focus Block',
  startTime: '2026-11-02T09:00:00.000Z',
  endTime: '2026-11-02T10:00:00.000Z',
  status: 'upcoming',
  priority: 'medium',
  createdAt: '2026-11-02T08:00:00.000Z',
  completedAt: null,
  ...overrides,
});

test('1. computeDayMetrics: correctly computes planned, completed, late, and rate', () => {
  const targetDate = new Date('2026-11-02T12:00:00.000Z');
  const tasks: Task[] = [
    createMockTask({ id: '1', status: 'completed', completedAt: '2026-11-02T09:50:00.000Z' }),
    createMockTask({
      id: '2',
      status: 'completed',
      startTime: '2026-11-02T10:00:00.000Z',
      endTime: '2026-11-02T11:00:00.000Z',
      completedAt: '2026-11-02T11:30:00.000Z', // Late completion
    }),
    createMockTask({ id: '3', status: 'missed' }),
    createMockTask({ id: '4', status: 'skipped' }),
  ];

  const metrics = computeDayMetrics(tasks, targetDate);

  assert.equal(metrics.totalPlanned, 4);
  assert.equal(metrics.completed, 2);
  assert.equal(metrics.completedLate, 1);
  assert.equal(metrics.missed, 1);
  assert.equal(metrics.skipped, 1);
  assert.equal(metrics.completionRate, 0.5); // 2 out of 4
  assert.equal(metrics.scheduledMinutes, 240); // 4 * 60 mins
});

test('2. computeWeeklyTrend: aggregates 7 days from Monday to Sunday', () => {
  const referenceDate = new Date('2026-11-04T12:00:00.000Z'); // Wednesday
  const tasks: Task[] = [
    // Monday Nov 2
    createMockTask({
      id: 'm1',
      startTime: '2026-11-02T09:00:00.000Z',
      endTime: '2026-11-02T10:00:00.000Z',
      status: 'completed',
    }),
    // Tuesday Nov 3
    createMockTask({
      id: 't1',
      startTime: '2026-11-03T09:00:00.000Z',
      endTime: '2026-11-03T10:00:00.000Z',
      status: 'completed',
    }),
    createMockTask({
      id: 't2',
      startTime: '2026-11-03T14:00:00.000Z',
      endTime: '2026-11-03T15:00:00.000Z',
      status: 'completed',
    }),
    // Wednesday Nov 4
    createMockTask({
      id: 'w1',
      startTime: '2026-11-04T09:00:00.000Z',
      endTime: '2026-11-04T10:00:00.000Z',
      status: 'missed',
    }),
  ];

  const historyEvents: TaskHistoryEvent[] = [
    {
      id: 'ev-1',
      taskId: 'w1',
      eventType: 'rescheduled',
      timestamp: '2026-11-04T10:05:00.000Z',
    },
    {
      id: 'ev-2',
      taskId: 'm1',
      eventType: 'completed_late',
      timestamp: '2026-11-02T11:00:00.000Z',
    },
  ];

  const trend = computeWeeklyTrend(tasks, historyEvents, referenceDate);

  assert.equal(trend.days.length, 7);
  assert.equal(trend.totalPlanned, 4);
  assert.equal(trend.totalCompleted, 3);
  assert.equal(trend.averageCompletionRate, 0.75); // 3 out of 4
  assert.equal(trend.rescheduleCount, 1);
  assert.equal(trend.lateRecoveryCount, 1);
  assert.equal(trend.mostProductiveDay, 'Tuesday'); // 2 tasks completed on Tuesday
});

test('3. computeMonthlyMetrics: aggregates totals over month window', () => {
  const referenceDate = new Date('2026-11-15T12:00:00.000Z');
  const tasks: Task[] = [
    createMockTask({
      id: '1',
      startTime: '2026-11-05T09:00:00.000Z',
      endTime: '2026-11-05T11:00:00.000Z', // 2 hours
      status: 'completed',
    }),
    createMockTask({
      id: '2',
      startTime: '2026-11-10T09:00:00.000Z',
      endTime: '2026-11-10T10:00:00.000Z', // 1 hour
      status: 'completed',
      completedAt: '2026-11-10T10:30:00.000Z',
    }),
    createMockTask({
      id: '3',
      startTime: '2026-11-20T09:00:00.000Z',
      endTime: '2026-11-20T10:00:00.000Z',
      status: 'missed',
    }),
  ];

  const historyEvents: TaskHistoryEvent[] = [
    {
      id: 'ev-1',
      taskId: '3',
      eventType: 'rescheduled',
      timestamp: '2026-11-20T10:15:00.000Z',
    },
  ];

  const monthly = computeMonthlyMetrics(tasks, historyEvents, referenceDate);

  assert.equal(monthly.totalPlanned, 3);
  assert.equal(monthly.totalCompleted, 2);
  assert.equal(monthly.completedLate, 1);
  assert.equal(monthly.missed, 1);
  assert.equal(monthly.rescheduledCount, 1);
  assert.equal(monthly.totalScheduledHours, 4); // 2 + 1 + 1 = 4 hours
});

test('4. computeResilienceMetrics: correctly measures recovered disruptions vs missed', () => {
  const tasks: Task[] = [
    createMockTask({ id: '1', status: 'completed' }),
    createMockTask({ id: '2', status: 'missed' }),
  ];

  const historyEvents: TaskHistoryEvent[] = [
    {
      id: 'h1',
      taskId: '3',
      eventType: 'completed_late',
      timestamp: '2026-11-02T10:00:00.000Z',
    },
    {
      id: 'h2',
      taskId: '4',
      eventType: 'rescheduled',
      timestamp: '2026-11-02T11:00:00.000Z',
    },
  ];

  const res = computeResilienceMetrics(tasks, historyEvents);

  // recoveredCount = 1 (completed_late) + 1 (rescheduled) = 2
  // unrecoveredMissed = 1
  // totalDisruptions = 2 + 1 = 3
  // resilienceScore = round(2 / 3 * 100) = 67%
  assert.equal(res.recoveredCount, 2);
  assert.equal(res.unrecoveredMissed, 1);
  assert.equal(res.totalDisruptions, 3);
  assert.equal(res.resilienceScore, 67);
});

test('5. computeFocusTimeDistribution: groups completed tasks into morning, afternoon, and evening', () => {
  const mStart = new Date(2026, 10, 2, 8, 0, 0).toISOString();
  const mEnd = new Date(2026, 10, 2, 10, 0, 0).toISOString();

  const aStart = new Date(2026, 10, 2, 14, 0, 0).toISOString();
  const aEnd = new Date(2026, 10, 2, 15, 0, 0).toISOString();

  const eStart = new Date(2026, 10, 2, 19, 0, 0).toISOString();
  const eEnd = new Date(2026, 10, 2, 20, 30, 0).toISOString();

  const tasks: Task[] = [
    // Morning (08:00 - 10:00 = 2h)
    createMockTask({
      id: '1',
      startTime: mStart,
      endTime: mEnd,
      status: 'completed',
    }),
    // Afternoon (14:00 - 15:00 = 1h)
    createMockTask({
      id: '2',
      startTime: aStart,
      endTime: aEnd,
      status: 'completed',
    }),
    // Evening (19:00 - 20:30 = 1.5h)
    createMockTask({
      id: '3',
      startTime: eStart,
      endTime: eEnd,
      status: 'completed',
    }),
  ];

  const dist = computeFocusTimeDistribution(tasks);

  assert.equal(dist.morningHours, 2);
  assert.equal(dist.afternoonHours, 1);
  assert.equal(dist.eveningHours, 1.5);
  assert.ok(dist.peakWindow.includes('Morning'));
});

test('6. computeActivityHeatmap: generates 28 days with correct intensity levels', () => {
  const referenceDate = new Date('2026-11-06T12:00:00.000Z');
  const tasks: Task[] = [
    // 2 completed tasks today
    createMockTask({
      id: '1',
      startTime: '2026-11-06T09:00:00.000Z',
      endTime: '2026-11-06T10:00:00.000Z',
      status: 'completed',
    }),
    createMockTask({
      id: '2',
      startTime: '2026-11-06T11:00:00.000Z',
      endTime: '2026-11-06T12:00:00.000Z',
      status: 'completed',
    }),
  ];

  const heat = computeActivityHeatmap(tasks, referenceDate, 28);

  assert.equal(heat.length, 28);
  const lastDay = heat[27];
  assert.equal(lastDay.completedCount, 2);
  assert.equal(lastDay.level, 2);
});
