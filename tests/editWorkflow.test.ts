import test from 'node:test';
import assert from 'node:assert/strict';
import { editTask } from '../src/services/statusEngine';
import { planTaskReminders } from '../src/services/notificationPlanner';
import { Task, UserSettings } from '../src/types/task';

const createSampleTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-edit-1',
  title: 'Original Title',
  description: 'Original Description',
  startTime: '2026-11-05T09:00:00.000Z',
  endTime: '2026-11-05T10:00:00.000Z',
  status: 'upcoming',
  priority: 'low',
  createdAt: '2026-11-05T08:00:00.000Z',
  completedAt: null,
  updatedAt: null,
  ...overrides,
});

test('1. editTask: updates title, description, priority and sets updatedAt', () => {
  const task = createSampleTask();
  const editTime = new Date('2026-11-05T08:30:00.000Z');

  const { updatedTask, historyEvent } = editTask(
    task,
    {
      title: 'Updated Title',
      description: 'Updated Description',
      priority: 'high',
      startTime: task.startTime,
      endTime: task.endTime,
    },
    editTime
  );

  assert.equal(updatedTask.title, 'Updated Title');
  assert.equal(updatedTask.description, 'Updated Description');
  assert.equal(updatedTask.priority, 'high');
  assert.equal(updatedTask.status, 'upcoming');
  assert.equal(updatedTask.updatedAt, editTime.toISOString());

  assert.equal(historyEvent.eventType, 'edited');
  assert.equal(historyEvent.taskId, task.id);
  assert.equal(historyEvent.timestamp, editTime.toISOString());
});

test('2. editTask: editing time window re-evaluates active status immediately', () => {
  const task = createSampleTask({ status: 'upcoming' });
  const editTime = new Date('2026-11-05T09:30:00.000Z');

  // Edit schedule so that editTime falls inside the new window
  const { updatedTask, historyEvent } = editTask(
    task,
    {
      title: task.title,
      priority: task.priority,
      startTime: '2026-11-05T09:00:00.000Z',
      endTime: '2026-11-05T10:30:00.000Z',
    },
    editTime
  );

  assert.equal(updatedTask.status, 'in_progress');
  assert.equal(historyEvent.eventType, 'edited');
  assert.equal(historyEvent.oldEndTime, '2026-11-05T10:00:00.000Z');
  assert.equal(historyEvent.newEndTime, '2026-11-05T10:30:00.000Z');
});

test('3. editTask: editing terminal task (completed) does not alter completed status', () => {
  const task = createSampleTask({
    status: 'completed',
    completedAt: '2026-11-05T09:45:00.000Z',
  });
  const editTime = new Date('2026-11-05T11:00:00.000Z');

  const { updatedTask } = editTask(
    task,
    {
      title: 'Refined Completed Task',
      priority: 'high',
      startTime: '2026-11-05T09:00:00.000Z',
      endTime: '2026-11-05T10:00:00.000Z',
    },
    editTime
  );

  assert.equal(updatedTask.title, 'Refined Completed Task');
  assert.equal(updatedTask.status, 'completed');
  assert.equal(updatedTask.completedAt, '2026-11-05T09:45:00.000Z');
});

test('4. Notification preferences: disabling 15m reminder suppresses it', () => {
  const task = createSampleTask({
    startTime: '2026-11-05T10:00:00.000Z',
    endTime: '2026-11-05T11:00:00.000Z',
  });
  const refTime = new Date('2026-11-05T09:00:00.000Z');

  const settings: UserSettings = {
    timeFormat: '12h',
    themeMode: 'light',
    enable15MinReminder: false, // Disabled
    enableStartReminder: true,
    enableOverdueReminder: true,
    defaultDurationMinutes: 45,
  };

  const reminders = planTaskReminders(task, refTime, settings);

  assert.equal(reminders.some((r) => r.triggerType === '15min_before'), false);
  assert.equal(reminders.some((r) => r.triggerType === 'at_start'), true);
  assert.equal(reminders.some((r) => r.triggerType === 'overdue'), true);
});

test('5. Notification preferences: disabling overdue reminder suppresses it', () => {
  const task = createSampleTask({
    startTime: '2026-11-05T10:00:00.000Z',
    endTime: '2026-11-05T11:00:00.000Z',
  });
  const refTime = new Date('2026-11-05T09:00:00.000Z');

  const settings: UserSettings = {
    timeFormat: '12h',
    themeMode: 'light',
    enable15MinReminder: true,
    enableStartReminder: true,
    enableOverdueReminder: false, // Disabled
    defaultDurationMinutes: 45,
  };

  const reminders = planTaskReminders(task, refTime, settings);

  assert.equal(reminders.some((r) => r.triggerType === 'overdue'), false);
  assert.equal(reminders.some((r) => r.triggerType === 'at_start'), true);
});

test('6. UserSettings: themeMode supports dark (Obsidian Precision) and light', () => {
  const defaultDarkSettings: UserSettings = {
    timeFormat: '12h',
    themeMode: 'dark',
    enable15MinReminder: true,
    enableStartReminder: true,
    enableOverdueReminder: true,
    defaultDurationMinutes: 45,
  };

  assert.equal(defaultDarkSettings.themeMode, 'dark');

  const toggledSettings: UserSettings = {
    ...defaultDarkSettings,
    themeMode: 'light',
  };

  assert.equal(toggledSettings.themeMode, 'light');
});


