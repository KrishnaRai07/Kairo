import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const CURRENT_SCHEMA_VERSION = 3;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('dayflow.db');
    await runMigrations(dbInstance);
  }
  return dbInstance;
}

/**
 * Resets the cached database connection instance (primarily used in testing and reset).
 */
export function resetDatabaseInstance(): void {
  dbInstance = null;
}

/**
 * Forward-only, versioned schema migration runner.
 * Guarantees zero user data loss when schema changes occur across application upgrades.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Enforce WAL mode and foreign key constraints on every connection
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  // Migration 1: Initial core schema
  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          created_at TEXT NOT NULL,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS task_history (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          old_start_time TEXT,
          old_end_time TEXT,
          new_start_time TEXT,
          new_end_time TEXT,
          note TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_reminders (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          scheduled_for TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks (start_time, end_time);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
        CREATE INDEX IF NOT EXISTS idx_history_task_id ON task_history (task_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON task_reminders (task_id);

        PRAGMA user_version = 1;
      `);
    });
  }

  // Migration 2: Add updated_at column, user_settings table, and history timestamp index
  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      // Check if updated_at already exists in tasks table before altering
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(tasks);');
      const hasUpdatedAt = tableInfo.some((col: { name: string }) => col.name === 'updated_at');
      if (!hasUpdatedAt) {
        await db.execAsync('ALTER TABLE tasks ADD COLUMN updated_at TEXT;');
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_history_timestamp ON task_history (timestamp);

        PRAGMA user_version = 2;
      `);
    });
  }

  // Migration 3: Add goals table, and goal_id & goal_day_number to tasks
  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          target_days INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          preferred_time TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL DEFAULT 45,
          priority TEXT NOT NULL DEFAULT 'medium',
          created_at TEXT NOT NULL
        );
      `);

      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(tasks);');
      const hasGoalId = tableInfo.some((col: { name: string }) => col.name === 'goal_id');
      if (!hasGoalId) {
        await db.execAsync(`
          ALTER TABLE tasks ADD COLUMN goal_id TEXT;
          ALTER TABLE tasks ADD COLUMN goal_day_number INTEGER;
        `);
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks (goal_id);
        PRAGMA user_version = 3;
      `);
    });
  }
}
