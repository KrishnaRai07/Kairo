import { Task, UserSettings } from '../types/task';

export type VoiceTriggerType = '15min_before' | 'at_start';

export interface DueVoiceAlert {
  alertKey: string;
  taskId: string;
  taskTitle: string;
  triggerType: VoiceTriggerType;
  script: string;
}

/**
 * Strips multi-day prefix like "[Day 1/30] " so voice speech sounds natural.
 */
export function sanitizeTitleForSpeech(title: string): string {
  return title.replace(/^\[Day\s+\d+\/\d+\]\s*/i, '').trim() || title.trim();
}

/**
 * Generates deterministic key for deduplicating spoken alerts per scheduled slot.
 */
export function getVoiceAlertKey(
  taskId: string,
  triggerType: VoiceTriggerType,
  startTimeIso: string
): string {
  return `${taskId}_${triggerType}_${startTimeIso}`;
}

/**
 * Constructs respectful voice reminder wording.
 */
export function buildVoiceScript(
  taskTitle: string,
  triggerType: VoiceTriggerType,
  salutation: string = 'Sir'
): string {
  const cleanSalutation = salutation.trim() || 'Sir';
  const cleanTitle = sanitizeTitleForSpeech(taskTitle);

  if (triggerType === '15min_before') {
    return `${cleanSalutation}, 15 minute baad aapka ${cleanTitle} schedule hai. Please make sure your availability for this task.`;
  }

  return `${cleanSalutation}, aapke task ${cleanTitle} ka samay ho gaya hai. Let's begin your focus block.`;
}

/**
 * Pure detector returning any voice reminders due around `referenceTime`
 * that have not already been spoken for the current schedule slot.
 */
export function findDueVoiceAlerts(
  tasks: Task[],
  referenceTime: Date,
  alreadySpokenKeys: Set<string>,
  settings?: UserSettings
): DueVoiceAlert[] {
  if (settings && settings.enableVoiceAlerts === false) {
    return [];
  }

  const allow15Min = settings ? settings.enable15MinReminder : true;
  const allowStart = settings ? settings.enableStartReminder : true;
  const salutation = settings?.voiceSalutation || 'Sir';

  const nowMs = referenceTime.getTime();
  const dueAlerts: DueVoiceAlert[] = [];

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'skipped' || task.status === 'missed') {
      continue;
    }

    const startMs = new Date(task.startTime).getTime();
    const endMs = new Date(task.endTime).getTime();
    const durationMs = endMs - startMs;

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || durationMs <= 0) {
      continue;
    }

    // 1. 15 minutes before start window: [start - 15m - 15s, start - 13m]
    if (allow15Min && durationMs >= 15 * 60 * 1000) {
      const fifteenBeforeMs = startMs - 15 * 60 * 1000;
      if (nowMs >= fifteenBeforeMs - 15 * 1000 && nowMs <= fifteenBeforeMs + 120 * 1000 && nowMs < startMs) {
        const key = getVoiceAlertKey(task.id, '15min_before', task.startTime);
        if (!alreadySpokenKeys.has(key)) {
          dueAlerts.push({
            alertKey: key,
            taskId: task.id,
            taskTitle: task.title,
            triggerType: '15min_before',
            script: buildVoiceScript(task.title, '15min_before', salutation),
          });
        }
      }
    }

    // 2. At exact task start window: [start - 10s, start + 120s]
    if (allowStart && nowMs >= startMs - 10 * 1000 && nowMs <= startMs + 120 * 1000 && nowMs < endMs) {
      const key = getVoiceAlertKey(task.id, 'at_start', task.startTime);
      if (!alreadySpokenKeys.has(key)) {
        dueAlerts.push({
          alertKey: key,
          taskId: task.id,
          taskTitle: task.title,
          triggerType: 'at_start',
          script: buildVoiceScript(task.title, 'at_start', salutation),
        });
      }
    }
  }

  return dueAlerts;
}

