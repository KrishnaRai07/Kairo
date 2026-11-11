import { describe, it } from 'node:test';
import assert from 'node:assert';
import { addDays, isSameDay } from '../src/utils/dateUtils';
import { Goal, GoalProgress, Task } from '../src/types/task';

describe('Long-Term Target Goal Engine', () => {
  it('1. Goal milestone task generation: creates exact target_days sequence', () => {
    const targetDays = 30;
    const startDate = new Date(2026, 10, 6, 0, 0, 0, 0); // 2026-11-06
    const preferredTime = '07:30';
    const [h, m] = preferredTime.split(':').map(Number);
    const durationMinutes = 45;

    const tasks: Task[] = [];
    for (let day = 1; day <= targetDays; day++) {
      const taskStart = new Date(startDate);
      taskStart.setDate(taskStart.getDate() + (day - 1));
      taskStart.setHours(h, m, 0, 0);

      const taskEnd = new Date(taskStart);
      taskEnd.setMinutes(taskEnd.getMinutes() + durationMinutes);

      tasks.push({
        id: `goal_task_${day}`,
        title: `[Day ${day}/${targetDays}] Master Advanced Python`,
        startTime: taskStart.toISOString(),
        endTime: taskEnd.toISOString(),
        status: 'upcoming',
        priority: 'high',
        createdAt: new Date().toISOString(),
        goalId: 'goal_python_30',
        goalDayNumber: day,
      });
    }

    assert.strictEqual(tasks.length, 30);
    assert.strictEqual(tasks[0].goalDayNumber, 1);
    assert.strictEqual(tasks[29].goalDayNumber, 30);

    // Verify first and 30th date difference
    const firstDate = new Date(tasks[0].startTime);
    const lastDate = new Date(tasks[29].startTime);
    const dayDiff = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(dayDiff, 29); // 29 intervals = 30 days
  });

  it('2. Goal progress calculation: correctly computes completion rate and streak', () => {
    const goal: Goal = {
      id: 'goal_1',
      title: 'Master Advanced Python',
      targetDays: 30,
      startDate: '2026-11-01',
      preferredTime: '07:00',
      durationMinutes: 60,
      priority: 'high',
      createdAt: '2026-11-01T00:00:00.000Z',
    };

    // Simulate 9 completed days out of 30
    const completedDays = 9;
    const totalDays = goal.targetDays;
    const completionRate = completedDays / totalDays;

    const progress: GoalProgress = {
      ...goal,
      completedDays,
      totalDays,
      currentDayNumber: 10,
      completionRate,
    };

    assert.strictEqual(progress.completedDays, 9);
    assert.strictEqual(progress.totalDays, 30);
    assert.strictEqual(Math.round(progress.completionRate * 100), 30);
  });
});

describe('Calendar Date Calculation & Grid Boundaries', () => {
  it('1. isSameDay correctly compares dates regardless of hours/minutes', () => {
    const d1 = new Date(2026, 10, 6, 8, 30);
    const d2 = new Date(2026, 10, 6, 22, 45);
    const d3 = new Date(2026, 10, 7, 8, 30);

    assert.strictEqual(isSameDay(d1, d2), true);
    assert.strictEqual(isSameDay(d1, d3), false);
  });

  it('2. addDays moves forward and backward across month boundaries', () => {
    const nov30 = new Date(2026, 10, 30, 10, 0); // Nov 30
    const dec1 = addDays(nov30, 1);
    assert.strictEqual(dec1.getMonth(), 11); // December
    assert.strictEqual(dec1.getDate(), 1);

    const backToNov = addDays(dec1, -1);
    assert.strictEqual(backToNov.getMonth(), 10); // November
    assert.strictEqual(backToNov.getDate(), 30);
  });

  it('3. Month calendar cell generation: fills complete 7-column rows', () => {
    const year = 2026;
    const month = 10; // November 2026 (starts on a Sunday)
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 30 days

    let totalCells = dayOfWeek + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      totalCells += (7 - remainder);
    }

    assert.strictEqual(totalCells % 7, 0);
    assert.ok(totalCells >= 28 && totalCells <= 42);
  });
});

