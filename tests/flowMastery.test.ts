import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFlowScoreAndMastery } from '../src/services/analyticsService';
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

test('1. computeFlowScoreAndMastery: evaluates balanced 4-pillar score on successful day', () => {
  const refDate = new Date('2026-11-02T12:00:00.000Z');
  const tasks: Task[] = [
    createMockTask({
      id: '1',
      startTime: '2026-11-02T09:00:00.000Z',
      endTime: '2026-11-02T10:00:00.000Z',
      status: 'completed',
      completedAt: '2026-11-02T09:55:00.000Z',
    }),
    createMockTask({
      id: '2',
      startTime: '2026-11-02T10:00:00.000Z',
      endTime: '2026-11-02T11:00:00.000Z',
      status: 'completed',
      completedAt: '2026-11-02T10:55:00.000Z',
    }),
    createMockTask({
      id: '3',
      startTime: '2026-11-02T11:00:00.000Z',
      endTime: '2026-11-02T12:00:00.000Z',
      status: 'completed',
      completedAt: '2026-11-02T11:55:00.000Z',
    }),
  ];

  const result = computeFlowScoreAndMastery(tasks, [], refDate);

  assert.ok(result.overallScore >= 70, `Score ${result.overallScore} should be >= 70`);
  assert.equal(result.breakdown.executionScore, 100);
  assert.equal(result.breakdown.resilienceScore, 100); // No disruptions = 100%
  assert.equal(result.breakdown.pacingScore, 100); // 3 tasks = balanced load
  assert.ok(result.statusRating === 'peak' || result.statusRating === 'steady');
});

test('2. computeFlowScoreAndMastery: late completion acknowledges recovery', () => {
  const refDate = new Date('2026-11-02T12:00:00.000Z');
  const tasks: Task[] = [
    createMockTask({
      id: '1',
      status: 'completed',
      startTime: '2026-11-02T09:00:00.000Z',
      endTime: '2026-11-02T10:00:00.000Z',
      completedAt: '2026-11-02T10:45:00.000Z', // Late completion
    }),
  ];

  const result = computeFlowScoreAndMastery(tasks, [], refDate);

  assert.equal(result.breakdown.executionScore, 85); // 0.85 credit for recovering late
});

test('3. computeFlowScoreAndMastery: unlocks Level 3 (Flow Keeper) when 30 days >= 80 score exist', () => {
  const refDate = new Date('2026-11-02T12:00:00.000Z');
  const tasks: Task[] = [];

  // Generate 32 consecutive past days with 100% completion
  for (let i = 0; i < 32; i++) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    tasks.push(
      createMockTask({
        id: `t-${i}`,
        startTime: `${dateStr}T09:00:00.000Z`,
        endTime: `${dateStr}T10:00:00.000Z`,
        status: 'completed',
        completedAt: `${dateStr}T09:50:00.000Z`,
      })
    );
  }

  const result = computeFlowScoreAndMastery(tasks, [], refDate);

  assert.equal(result.masteryLevel.level, 3);
  assert.equal(result.masteryLevel.tier, 'keeper');
  assert.equal(result.masteryLevel.title, 'Flow Keeper');
  assert.equal(result.masteryLevel.badge, '⚡');
  assert.ok(result.masteryLevel.isUnlocked);
});

test('4. computeFlowScoreAndMastery: provides psychological safety coaching during recharge days', () => {
  const refDate = new Date('2026-11-02T12:00:00.000Z');
  const tasks: Task[] = [
    createMockTask({ id: 'm1', status: 'missed' }),
    createMockTask({ id: 'm2', status: 'missed' }),
  ];

  const events: TaskHistoryEvent[] = [
    { id: 'e1', taskId: 'm1', eventType: 'missed', timestamp: '2026-11-02T10:00:00.000Z' },
    { id: 'e2', taskId: 'm2', eventType: 'missed', timestamp: '2026-11-02T11:00:00.000Z' },
  ];

  const result = computeFlowScoreAndMastery(tasks, events, refDate);

  assert.equal(result.statusRating, 'recharge');
  assert.equal(result.statusLabel, 'Recharging State');
  assert.ok(result.motivationalMessage.includes('Heavy day'));
});
