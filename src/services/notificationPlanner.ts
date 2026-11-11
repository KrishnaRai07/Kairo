import { Task, ReminderTriggerType, UserSettings } from '../types/task';
import { sanitizeTitleForSpeech } from './voicePlanner';

export interface PlannedReminder {
  triggerType: ReminderTriggerType;
  scheduledFor: string; // ISO string
  title: string;
  body: string;
}

/**
 * Pure calculation of which reminders should be scheduled for a given task.
 * Respects user preferences, avoids duplicate reminders for short tasks, and filters out past times.
 */
export function planTaskReminders(
  task: Task,
  referenceTime: Date = new Date(),
  settings?: UserSettings
): PlannedReminder[] {
  // If task is already completed or skipped, no reminders needed
  if (task.status === 'completed' || task.status === 'skipped') {
    return [];
  }

  const allow15Min = settings ? settings.enable15MinReminder : true;
  const allowStart = settings ? settings.enableStartReminder : true;
  const allowOverdue = settings ? settings.enableOverdueReminder : true;
  const salutation = settings?.voiceSalutation?.trim() || 'Sir';
  const cleanTitle = sanitizeTitleForSpeech(task.title);

  const nowMs = referenceTime.getTime();
  const startMs = new Date(task.startTime).getTime();
  const endMs = new Date(task.endTime).getTime();
  const durationMs = endMs - startMs;

  const planned: PlannedReminder[] = [];

  // Minimum duration check: end must be after start
  if (durationMs <= 0) {
    return planned;
  }

  // 1. 15-Minute Pre-start Reminder
  // Criteria:
  // - Enabled in settings
  // - Alarm must be in the future (at least 60 seconds from referenceTime)
  // - Task duration should be reasonable (at least 15 minutes), so short 5-minute micro-tasks don't barrage the user
  if (allow15Min) {
    const fifteenBeforeMs = startMs - 15 * 60 * 1000;
    if (fifteenBeforeMs > nowMs + 60 * 1000 && durationMs >= 15 * 60 * 1000) {
      planned.push({
        triggerType: '15min_before',
        scheduledFor: new Date(fifteenBeforeMs).toISOString(),
        title: `⏰ Upcoming in 15m: ${cleanTitle}`,
        body: `${salutation}, 15 minute baad aapka "${cleanTitle}" schedule hai. Please ensure your availability.`,
      });
    }
  }

  // 2. At Start Reminder
  // Only schedule if start time is in the future
  if (allowStart && startMs > nowMs + 30 * 1000) {
    planned.push({
      triggerType: 'at_start',
      scheduledFor: new Date(startMs).toISOString(),
      title: `⚡ Starts Now: ${cleanTitle}`,
      body: `${salutation}, aapke task "${cleanTitle}" ka samay ho gaya hai. Let's begin!`,
    });
  }

  // 3. Overdue Reminder (associated with scheduled end time)
  // Triggers when the task becomes missed. Must be in the future and strictly after start.
  if (allowOverdue && endMs > nowMs + 30 * 1000 && endMs > startMs) {
    planned.push({
      triggerType: 'overdue',
      scheduledFor: new Date(endMs).toISOString(),
      title: `Task Check-in: ${cleanTitle}`,
      body: `Block ended. Tap Done Late or reschedule without guilt.`,
    });
  }

  return planned;
}
