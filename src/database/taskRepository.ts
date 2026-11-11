import { getDatabase } from './db';
import {
  Task,
  TaskHistoryEvent,
  TaskReminder,
  TaskStatus,
  UserSettings,
  DEFAULT_USER_SETTINGS,
  Goal,
  GoalProgress,
} from '../types/task';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  priority: string;
  created_at: string;
  completed_at: string | null;
  updated_at?: string | null;
  goal_id?: string | null;
  goal_day_number?: number | null;
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  target_days: number;
  start_date: string;
  preferred_time: string;
  duration_minutes: number;
  priority: string;
  created_at: string;
}

interface HistoryRow {
  id: string;
  task_id: string;
  event_type: string;
  timestamp: string;
  old_start_time: string | null;
  old_end_time: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  note: string | null;
}

interface ReminderRow {
  id: string;
  task_id: string;
  notification_id: string;
  trigger_type: string;
  scheduled_for: string;
}

interface SettingRow {
  key: string;
  value: string;
}

function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status as TaskStatus,
    priority: row.priority as any,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at || null,
    goalId: row.goal_id || null,
    goalDayNumber: row.goal_day_number ?? null,
  };
}

function mapRowToHistory(row: HistoryRow): TaskHistoryEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type as any,
    timestamp: row.timestamp,
    oldStartTime: row.old_start_time,
    oldEndTime: row.old_end_time,
    newStartTime: row.new_start_time,
    newEndTime: row.new_end_time,
    note: row.note || undefined,
  };
}

export class TaskRepository {
  /**
   * Inserts a new task, its initial reminders, and creation history event atomically.
   */
  static async createTask(
    task: Task,
    reminders: TaskReminder[] = [],
    historyEvent?: TaskHistoryEvent
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO tasks (id, title, description, start_time, end_time, status, priority, created_at, completed_at, updated_at, goal_id, goal_day_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.description ?? null,
          task.startTime,
          task.endTime,
          task.status,
          task.priority,
          task.createdAt,
          task.completedAt ?? null,
          task.updatedAt ?? null,
          task.goalId ?? null,
          task.goalDayNumber ?? null,
        ]
      );

      if (historyEvent) {
        await db.runAsync(
          `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyEvent.id,
            historyEvent.taskId,
            historyEvent.eventType,
            historyEvent.timestamp,
            historyEvent.oldStartTime ?? null,
            historyEvent.oldEndTime ?? null,
            historyEvent.newStartTime ?? null,
            historyEvent.newEndTime ?? null,
            historyEvent.note ?? null,
          ]
        );
      }

      for (const reminder of reminders) {
        await db.runAsync(
          `INSERT INTO task_reminders (id, task_id, notification_id, trigger_type, scheduled_for)
           VALUES (?, ?, ?, ?, ?)`,
          [
            reminder.id,
            reminder.taskId,
            reminder.notificationId,
            reminder.triggerType,
            reminder.scheduledFor,
          ]
        );
      }
    });
  }

  /**
   * Updates an existing task's details, recalculates reminders, and logs an audit event atomically.
   * Returns old notification IDs for OS cancellation.
   */
  static async updateTask(
    task: Task,
    newReminders: TaskReminder[] = [],
    historyEvent?: TaskHistoryEvent
  ): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks 
         SET title = ?, description = ?, start_time = ?, end_time = ?, status = ?, priority = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          task.title,
          task.description ?? null,
          task.startTime,
          task.endTime,
          task.status,
          task.priority,
          task.completedAt ?? null,
          task.updatedAt ?? new Date().toISOString(),
          task.id,
        ]
      );

      if (historyEvent) {
        await db.runAsync(
          `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyEvent.id,
            historyEvent.taskId,
            historyEvent.eventType,
            historyEvent.timestamp,
            historyEvent.oldStartTime ?? null,
            historyEvent.oldEndTime ?? null,
            historyEvent.newStartTime ?? null,
            historyEvent.newEndTime ?? null,
            historyEvent.note ?? null,
          ]
        );
      }

      // Fetch existing reminders for OS cancellation
      const existing = await db.getAllAsync<ReminderRow>(
        `SELECT * FROM task_reminders WHERE task_id = ?`,
        [task.id]
      );
      cancelledNotificationIds = existing.map((r: ReminderRow) => r.notification_id);

      await db.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [task.id]);

      for (const r of newReminders) {
        await db.runAsync(
          `INSERT INTO task_reminders (id, task_id, notification_id, trigger_type, scheduled_for)
           VALUES (?, ?, ?, ?, ?)`,
          [r.id, r.taskId, r.notificationId, r.triggerType, r.scheduledFor]
        );
      }
    });

    return cancelledNotificationIds;
  }

  /**
   * Fetch all tasks that overlap with or belong to a specified ISO date range.
   */
  static async getTasksForDateRange(rangeStartIso: string, rangeEndIso: string): Promise<Task[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks 
       WHERE (start_time >= ? AND start_time <= ?)
          OR (end_time >= ? AND end_time <= ?)
          OR (start_time <= ? AND end_time >= ?)
       ORDER BY start_time ASC`,
      [rangeStartIso, rangeEndIso, rangeStartIso, rangeEndIso, rangeStartIso, rangeEndIso]
    );
    return rows.map(mapRowToTask);
  }

  /**
   * Fetch all tasks (e.g. for complete status reconciliation).
   */
  static async getAllTasks(): Promise<Task[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<TaskRow>(`SELECT * FROM tasks ORDER BY start_time ASC`);
    return rows.map(mapRowToTask);
  }

  /**
   * Fetch a single task by ID.
   */
  static async getTaskById(taskId: string): Promise<Task | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    return row ? mapRowToTask(row) : null;
  }

  /**
   * Batch updates tasks that changed status during reconciliation, saving corresponding history events atomically.
   */
  static async batchUpdateTaskStatuses(
    tasks: Task[],
    events: TaskHistoryEvent[]
  ): Promise<void> {
    if (tasks.length === 0) return;
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const task of tasks) {
        await db.runAsync(
          `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
          [task.status, task.completedAt ?? null, task.updatedAt ?? null, task.id]
        );
      }

      for (const ev of events) {
        await db.runAsync(
          `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ev.id,
            ev.taskId,
            ev.eventType,
            ev.timestamp,
            ev.oldStartTime ?? null,
            ev.oldEndTime ?? null,
            ev.newStartTime ?? null,
            ev.newEndTime ?? null,
            ev.note ?? null,
          ]
        );
      }
    });
  }

  /**
   * Mark a task completed or completed_late.
   */
  static async completeTask(task: Task, historyEvent: TaskHistoryEvent): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
        [task.status, task.completedAt ?? null, new Date().toISOString(), task.id]
      );

      await db.runAsync(
        `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyEvent.id,
          historyEvent.taskId,
          historyEvent.eventType,
          historyEvent.timestamp,
          historyEvent.oldStartTime ?? null,
          historyEvent.oldEndTime ?? null,
          historyEvent.newStartTime ?? null,
          historyEvent.newEndTime ?? null,
          historyEvent.note ?? null,
        ]
      );

      // Cancel and clear remaining pending reminders
      const reminders = await db.getAllAsync<ReminderRow>(
        `SELECT * FROM task_reminders WHERE task_id = ?`,
        [task.id]
      );
      cancelledNotificationIds = reminders.map((r: ReminderRow) => r.notification_id);

      await db.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [task.id]);
    });

    return cancelledNotificationIds;
  }

  /**
   * Mark a task skipped.
   */
  static async skipTask(task: Task, historyEvent: TaskHistoryEvent): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
        [task.status, new Date().toISOString(), task.id]
      );

      await db.runAsync(
        `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyEvent.id,
          historyEvent.taskId,
          historyEvent.eventType,
          historyEvent.timestamp,
          historyEvent.oldStartTime ?? null,
          historyEvent.oldEndTime ?? null,
          historyEvent.newStartTime ?? null,
          historyEvent.newEndTime ?? null,
          historyEvent.note ?? null,
        ]
      );

      const reminders = await db.getAllAsync<ReminderRow>(
        `SELECT * FROM task_reminders WHERE task_id = ?`,
        [task.id]
      );
      cancelledNotificationIds = reminders.map((r: ReminderRow) => r.notification_id);

      await db.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [task.id]);
    });

    return cancelledNotificationIds;
  }

  /**
   * Reschedule a task to new times.
   */
  static async rescheduleTask(
    task: Task,
    newReminders: TaskReminder[],
    historyEvent: TaskHistoryEvent
  ): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks SET start_time = ?, end_time = ?, status = ?, completed_at = NULL, updated_at = ? WHERE id = ?`,
        [task.startTime, task.endTime, task.status, new Date().toISOString(), task.id]
      );

      await db.runAsync(
        `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyEvent.id,
          historyEvent.taskId,
          historyEvent.eventType,
          historyEvent.timestamp,
          historyEvent.oldStartTime ?? null,
          historyEvent.oldEndTime ?? null,
          historyEvent.newStartTime ?? null,
          historyEvent.newEndTime ?? null,
          historyEvent.note ?? null,
        ]
      );

      const existing = await db.getAllAsync<ReminderRow>(
        `SELECT * FROM task_reminders WHERE task_id = ?`,
        [task.id]
      );
      cancelledNotificationIds = existing.map((r: ReminderRow) => r.notification_id);

      await db.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [task.id]);

      for (const r of newReminders) {
        await db.runAsync(
          `INSERT INTO task_reminders (id, task_id, notification_id, trigger_type, scheduled_for)
           VALUES (?, ?, ?, ?, ?)`,
          [r.id, r.taskId, r.notificationId, r.triggerType, r.scheduledFor]
        );
      }
    });

    return cancelledNotificationIds;
  }

  /**
   * Delete a task and its reminders/history completely.
   */
  static async deleteTask(taskId: string): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      const existing = await db.getAllAsync<ReminderRow>(
        `SELECT * FROM task_reminders WHERE task_id = ?`,
        [taskId]
      );
      cancelledNotificationIds = existing.map((r: ReminderRow) => r.notification_id);

      await db.runAsync(`DELETE FROM tasks WHERE id = ?`, [taskId]);
    });

    return cancelledNotificationIds;
  }

  /**
   * Fetch all history events for a task.
   */
  static async getTaskHistory(taskId: string): Promise<TaskHistoryEvent[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<HistoryRow>(
      `SELECT * FROM task_history WHERE task_id = ? ORDER BY timestamp ASC`,
      [taskId]
    );
    return rows.map(mapRowToHistory);
  }

  /**
   * Fetch history events in an ISO date range (for analytics).
   */
  static async getHistoryEventsForDateRange(
    startIso: string,
    endIso: string
  ): Promise<TaskHistoryEvent[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<HistoryRow>(
      `SELECT * FROM task_history WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`,
      [startIso, endIso]
    );
    return rows.map(mapRowToHistory);
  }

  /**
   * Fetch storage statistics (task count, history events, active reminders).
   */
  static async getStorageStatistics(): Promise<{
    taskCount: number;
    historyCount: number;
    reminderCount: number;
  }> {
    const db = await getDatabase();
    const taskCountRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM tasks`);
    const historyCountRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM task_history`);
    const reminderCountRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM task_reminders`);

    return {
      taskCount: taskCountRow?.count ?? 0,
      historyCount: historyCountRow?.count ?? 0,
      reminderCount: reminderCountRow?.count ?? 0,
    };
  }

  /**
   * Exports all tasks and history for local JSON backup.
   */
  static async exportAllData(): Promise<{
    tasks: Task[];
    history: TaskHistoryEvent[];
    exportDate: string;
  }> {
    const db = await getDatabase();
    const taskRows = await db.getAllAsync<TaskRow>(`SELECT * FROM tasks ORDER BY start_time ASC`);
    const historyRows = await db.getAllAsync<HistoryRow>(`SELECT * FROM task_history ORDER BY timestamp ASC`);

    return {
      tasks: taskRows.map(mapRowToTask),
      history: historyRows.map(mapRowToHistory),
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Clears all task and history records (for test/reset).
   */
  static async clearAllData(): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM task_reminders;`);
      await db.runAsync(`DELETE FROM task_history;`);
      await db.runAsync(`DELETE FROM tasks;`);
      await db.runAsync(`DELETE FROM goals;`);
    });
  }

  /**
   * Persists a long-term goal and all its generated daily tasks in a single atomic transaction.
   */
  static async createGoal(goal: Goal, tasks: Task[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO goals (id, title, description, target_days, start_date, preferred_time, duration_minutes, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goal.id,
          goal.title,
          goal.description ?? null,
          goal.targetDays,
          goal.startDate,
          goal.preferredTime,
          goal.durationMinutes,
          goal.priority,
          goal.createdAt,
        ]
      );

      for (const t of tasks) {
        await db.runAsync(
          `INSERT INTO tasks (id, title, description, start_time, end_time, status, priority, created_at, completed_at, updated_at, goal_id, goal_day_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.title,
            t.description ?? null,
            t.startTime,
            t.endTime,
            t.status,
            t.priority,
            t.createdAt,
            t.completedAt ?? null,
            t.updatedAt ?? null,
            t.goalId ?? null,
            t.goalDayNumber ?? null,
          ]
        );

        await db.runAsync(
          `INSERT INTO task_history (id, task_id, event_type, timestamp, new_start_time, new_end_time, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `${t.id}_hist`,
            t.id,
            'created',
            t.createdAt,
            t.startTime,
            t.endTime,
            `Goal Milestone Scheduled: Day ${t.goalDayNumber} of ${goal.targetDays}`,
          ]
        );
      }
    });
  }

  /**
   * Retrieves all goals with calculated progress statistics.
   */
  static async getAllGoals(): Promise<GoalProgress[]> {
    const db = await getDatabase();
    const goalRows = await db.getAllAsync<GoalRow>(`SELECT * FROM goals ORDER BY created_at DESC`);
    const progressList: GoalProgress[] = [];

    const now = new Date();

    for (const g of goalRows) {
      const taskRows = await db.getAllAsync<TaskRow>(
        `SELECT * FROM tasks WHERE goal_id = ? ORDER BY goal_day_number ASC`,
        [g.id]
      );

      const totalDays = g.target_days;
      const completedDays = taskRows.filter((t) => t.status === 'completed').length;

      const startDate = new Date(g.start_date);
      startDate.setHours(0, 0, 0, 0);
      const todayDate = new Date(now);
      todayDate.setHours(0, 0, 0, 0);

      const diffTime = todayDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const currentDayNumber = Math.max(1, Math.min(totalDays, diffDays));

      const completionRate = totalDays > 0 ? completedDays / totalDays : 0;

      progressList.push({
        id: g.id,
        title: g.title,
        description: g.description ?? undefined,
        targetDays: g.target_days,
        startDate: g.start_date,
        preferredTime: g.preferred_time,
        durationMinutes: g.duration_minutes,
        priority: g.priority as any,
        createdAt: g.created_at,
        completedDays,
        totalDays,
        currentDayNumber,
        completionRate,
      });
    }

    return progressList;
  }

  /**
   * Deletes a goal and all linked tasks, reminders, and history records.
   * Returns reminder notification IDs to be cancelled on the OS.
   */
  static async deleteGoal(goalId: string): Promise<string[]> {
    const db = await getDatabase();
    let cancelledNotificationIds: string[] = [];

    await db.withTransactionAsync(async () => {
      const tasks = await db.getAllAsync<TaskRow>(`SELECT id FROM tasks WHERE goal_id = ?`, [goalId]);
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length > 0) {
        for (const taskId of taskIds) {
          const reminders = await db.getAllAsync<ReminderRow>(
            `SELECT notification_id FROM task_reminders WHERE task_id = ?`,
            [taskId]
          );
          for (const r of reminders) {
            cancelledNotificationIds.push(r.notification_id);
          }
          await db.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [taskId]);
          await db.runAsync(`DELETE FROM task_history WHERE task_id = ?`, [taskId]);
        }
        await db.runAsync(`DELETE FROM tasks WHERE goal_id = ?`, [goalId]);
      }

      await db.runAsync(`DELETE FROM goals WHERE id = ?`, [goalId]);
    });

    return cancelledNotificationIds;
  }

  /**
   * Get user settings with defaults.
   */
  static async getSettings(): Promise<UserSettings> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SettingRow>(`SELECT * FROM user_settings`);
    const settings: Record<string, any> = {};

    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return {
      timeFormat: settings.timeFormat ?? DEFAULT_USER_SETTINGS.timeFormat,
      themeMode: settings.themeMode === 'light' ? 'light' : 'dark',
      enable15MinReminder: settings.enable15MinReminder ?? DEFAULT_USER_SETTINGS.enable15MinReminder,
      enableStartReminder: settings.enableStartReminder ?? DEFAULT_USER_SETTINGS.enableStartReminder,
      enableOverdueReminder: settings.enableOverdueReminder ?? DEFAULT_USER_SETTINGS.enableOverdueReminder,
      defaultDurationMinutes: settings.defaultDurationMinutes ?? DEFAULT_USER_SETTINGS.defaultDurationMinutes,
      enableHaptics: settings.enableHaptics ?? DEFAULT_USER_SETTINGS.enableHaptics,
      dayStartHour: settings.dayStartHour ?? DEFAULT_USER_SETTINGS.dayStartHour,
      enableVoiceAlerts: settings.enableVoiceAlerts ?? DEFAULT_USER_SETTINGS.enableVoiceAlerts,
      voiceSalutation: settings.voiceSalutation ?? DEFAULT_USER_SETTINGS.voiceSalutation,
      voiceLanguage: settings.voiceLanguage ?? DEFAULT_USER_SETTINGS.voiceLanguage,
      enableAppLock: settings.enableAppLock ?? DEFAULT_USER_SETTINGS.enableAppLock,
      enableBiometrics: settings.enableBiometrics ?? DEFAULT_USER_SETTINGS.enableBiometrics,
      lockTimeoutSeconds: settings.lockTimeoutSeconds ?? DEFAULT_USER_SETTINGS.lockTimeoutSeconds,
    };
  }

  /**
   * Imports and restores backup JSON data into local SQLite atomically.
   */
  static async importAllData(data: { tasks: Task[]; history?: TaskHistoryEvent[]; goals?: Goal[] }): Promise<{ importedTasks: number }> {
    if (!data || !Array.isArray(data.tasks)) {
      throw new Error('Invalid backup file format: tasks array missing');
    }

    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM task_reminders;`);
      await db.runAsync(`DELETE FROM task_history;`);
      await db.runAsync(`DELETE FROM tasks;`);
      await db.runAsync(`DELETE FROM goals;`);

      if (Array.isArray(data.goals)) {
        for (const g of data.goals) {
          await db.runAsync(
            `INSERT INTO goals (id, title, description, target_days, start_date, preferred_time, duration_minutes, priority, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              g.id,
              g.title,
              g.description ?? null,
              g.targetDays,
              g.startDate,
              g.preferredTime,
              g.durationMinutes,
              g.priority,
              g.createdAt,
            ]
          );
        }
      }

      for (const t of data.tasks) {
        await db.runAsync(
          `INSERT INTO tasks (id, title, description, start_time, end_time, status, priority, created_at, completed_at, updated_at, goal_id, goal_day_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.title,
            t.description ?? null,
            t.startTime,
            t.endTime,
            t.status,
            t.priority,
            t.createdAt,
            t.completedAt ?? null,
            t.updatedAt ?? null,
            t.goalId ?? null,
            t.goalDayNumber ?? null,
          ]
        );
      }

      if (Array.isArray(data.history)) {
        for (const h of data.history) {
          await db.runAsync(
            `INSERT INTO task_history (id, task_id, event_type, timestamp, old_start_time, old_end_time, new_start_time, new_end_time, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              h.id,
              h.taskId,
              h.eventType,
              h.timestamp,
              h.oldStartTime ?? null,
              h.oldEndTime ?? null,
              h.newStartTime ?? null,
              h.newEndTime ?? null,
              h.note ?? null,
            ]
          );
        }
      }
    });

    return { importedTasks: data.tasks.length };
  }

  /**
   * Persist user settings.
   */
  static async saveSettings(newSettings: Partial<UserSettings>): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const [key, value] of Object.entries(newSettings)) {
        await db.runAsync(
          `INSERT INTO user_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, JSON.stringify(value)]
        );
      }
    });
  }
}
