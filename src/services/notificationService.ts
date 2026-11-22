import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Task, TaskReminder, UserSettings } from '../types/task';
import { generateUUID } from './statusEngine';
import { planTaskReminders, PlannedReminder } from './notificationPlanner';

export { planTaskReminders, PlannedReminder };

export const REMINDER_CHANNEL_ID = 'kairo-reminders';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Ensures high-priority notification channel exists on Android 8.0+ (API 26+)
 * with maximum importance, sound, vibration, and lockscreen visibility.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Task Reminders & Voice Alerts',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38BDF8',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    } catch (e) {
      console.warn('Failed to configure Android notification channel:', e);
    }
  }
}

/**
 * Requests notification permissions from the OS and ensures notification channels.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    await setupNotificationChannels();
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
  await setupNotificationChannels();
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
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: REMINDER_CHANNEL_ID,
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
