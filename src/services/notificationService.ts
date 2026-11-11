import * as Notifications from 'expo-notifications';
import { Task, TaskReminder, UserSettings } from '../types/task';
import { generateUUID } from './statusEngine';
import { planTaskReminders, PlannedReminder } from './notificationPlanner';

export { planTaskReminders, PlannedReminder };

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Requests notification permissions from the OS.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.warn('Failed to check or request notification permissions:', error);
    return false;
  }
}

/**
 * Schedules all planned reminders for a task via Expo Notifications.
 * Returns the created TaskReminder records for persistence.
 */
export async function scheduleRemindersForTask(
  task: Task,
  referenceTime: Date = new Date(),
  settings?: UserSettings
): Promise<TaskReminder[]> {
  const planned = planTaskReminders(task, referenceTime, settings);
  const createdReminders: TaskReminder[] = [];

  for (const item of planned) {
    try {
      const triggerDate = new Date(item.scheduledFor);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: {
            taskId: task.id,
            triggerType: item.triggerType,
            taskTitle: task.title,
            startTime: task.startTime,
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      createdReminders.push({
        id: generateUUID(),
        taskId: task.id,
        notificationId,
        triggerType: item.triggerType,
        scheduledFor: item.scheduledFor,
      });
    } catch (error) {
      console.warn(`Failed to schedule reminder ${item.triggerType} for task ${task.id}:`, error);
    }
  }

  return createdReminders;
}

/**
 * Cancels a list of scheduled notifications in the OS.
 */
export async function cancelNotificationIds(notificationIds: string[]): Promise<void> {
  for (const notifId of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notifId);
    } catch {
      // Notification might already have fired or been purged by the OS
    }
  }
}
