import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  Task,
  DayProgressSummary,
  TaskPriority,
  TaskHistoryEvent,
  UserSettings,
  DEFAULT_USER_SETTINGS,
  Goal,
  GoalProgress,
} from '../types/task';
import { TaskRepository } from '../database/taskRepository';
import {
  evaluateTaskStatus,
  reconcileAllTasks,
  completeTask,
  skipTask,
  rescheduleTask,
  editTask,
  computeDaySummary,
  generateUUID,
} from '../services/statusEngine';
import {
  scheduleRemindersForTask,
  cancelNotificationIds,
  requestNotificationPermissions,
} from '../services/notificationService';
import {
  triggerSuccessHaptic,
  triggerLightTapHaptic,
  triggerSelectionHaptic,
} from '../services/hapticsService';
import { getDayBoundaries } from '../utils/dateUtils';

export function useTasks(initialDate: Date = new Date()) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyModalTask, setHistoryModalTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEvent[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  const isReconcilingRef = useRef<boolean>(false);

  // Load user settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await TaskRepository.getSettings();
        setSettings(s);
      } catch (e) {
        console.warn('Failed to load user settings:', e);
      }
    }
    loadSettings();
  }, []);

  // Load active long-term goals
  const loadGoals = useCallback(async () => {
    try {
      const allGoals = await TaskRepository.getAllGoals();
      setGoals(allGoals);
    } catch (e) {
      console.warn('Failed to load goals:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initGoals() {
      try {
        const allGoals = await TaskRepository.getAllGoals();
        if (isMounted) setGoals(allGoals);
      } catch (e) {
        console.warn('Failed to load goals:', e);
      }
    }
    initGoals();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateSettings = async (newPartial: Partial<UserSettings>) => {
    try {
      const updated = { ...settings, ...newPartial };
      setSettings(updated);
      await TaskRepository.saveSettings(newPartial);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  };

  // Load tasks for selected date
  const loadTasks = useCallback(async (date: Date = selectedDate) => {
    try {
      const { startOfDay, endOfDay } = getDayBoundaries(date);
      const dateTasks = await TaskRepository.getTasksForDateRange(startOfDay, endOfDay);
      setTasks(dateTasks);
    } catch (error) {
      console.warn('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Reconcile all tasks deterministically
  const reconcile = useCallback(async () => {
    if (isReconcilingRef.current) return;
    isReconcilingRef.current = true;

    try {
      const allTasks = await TaskRepository.getAllTasks();
      const now = new Date();
      const { updatedTasks, generatedEvents } = reconcileAllTasks(allTasks, now);

      if (generatedEvents.length > 0) {
        // Collect tasks that changed status
        const changedTasks = updatedTasks.filter((t) => {
          const original = allTasks.find((o) => o.id === t.id);
          return original && original.status !== t.status;
        });

        await TaskRepository.batchUpdateTaskStatuses(changedTasks, generatedEvents);
      }

      await loadTasks(selectedDate);
    } catch (error) {
      console.warn('Failed to reconcile task statuses:', error);
    } finally {
      isReconcilingRef.current = false;
    }
  }, [loadTasks, selectedDate]);

  // Reconcile on mount, foreground resume, and interval
  useEffect(() => {
    let isMounted = true;
    requestNotificationPermissions();

    async function initReconcile() {
      if (isReconcilingRef.current) return;
      isReconcilingRef.current = true;
      try {
        const allTasks = await TaskRepository.getAllTasks();
        const now = new Date();
        const { updatedTasks, generatedEvents } = reconcileAllTasks(allTasks, now);

        if (generatedEvents.length > 0) {
          const changedTasks = updatedTasks.filter((t) => {
            const original = allTasks.find((o) => o.id === t.id);
            return original && original.status !== t.status;
          });
          await TaskRepository.batchUpdateTaskStatuses(changedTasks, generatedEvents);
        }

        const { startOfDay, endOfDay } = getDayBoundaries(selectedDate);
        const dateTasks = await TaskRepository.getTasksForDateRange(startOfDay, endOfDay);
        if (isMounted) {
          setTasks(dateTasks);
        }
      } catch (error) {
        console.warn('Failed to reconcile task statuses:', error);
      } finally {
        isReconcilingRef.current = false;
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initReconcile();

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        reconcile();
      }
    });

    // Foreground periodic tick (every 30 seconds) to update active task visual state
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        reconcile();
      }
    }, 30000);

    return () => {
      isMounted = false;
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [reconcile, selectedDate]);

  // Reload when date changes
  useEffect(() => {
    let isMounted = true;
    async function fetchDateTasks() {
      try {
        const { startOfDay, endOfDay } = getDayBoundaries(selectedDate);
        const dateTasks = await TaskRepository.getTasksForDateRange(startOfDay, endOfDay);
        if (isMounted) {
          setTasks(dateTasks);
        }
      } catch (error) {
        console.warn('Failed to load tasks:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchDateTasks();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Actions
  const handleCreateTask = async (
    title: string,
    description: string | undefined,
    startTime: string,
    endTime: string,
    priority: TaskPriority = 'medium'
  ) => {
    const now = new Date();
    const newTask: Task = {
      id: generateUUID(),
      title: title.trim(),
      description: description?.trim() || undefined,
      startTime,
      endTime,
      status: 'upcoming',
      priority,
      createdAt: now.toISOString(),
      completedAt: null,
      updatedAt: null,
    };

    // Immediate status check against current time
    const evalResult = evaluateTaskStatus(newTask, now);
    const finalTask = evalResult.updatedTask;

    const reminders = await scheduleRemindersForTask(finalTask, now, settings);

    const historyEvent: TaskHistoryEvent = {
      id: generateUUID(),
      taskId: finalTask.id,
      eventType: 'created',
      timestamp: now.toISOString(),
      newStartTime: startTime,
      newEndTime: endTime,
      note: 'Task scheduled',
    };

    await TaskRepository.createTask(finalTask, reminders, historyEvent);
    await loadTasks(selectedDate);
  };

  const handleEditTask = async (
    task: Task,
    updates: {
      title: string;
      description?: string;
      priority: TaskPriority;
      startTime: string;
      endTime: string;
    },
    note?: string
  ) => {
    const now = new Date();
    const { updatedTask, historyEvent } = editTask(task, updates, now, note);

    const newReminders = await scheduleRemindersForTask(updatedTask, now, settings);

    const cancelledIds = await TaskRepository.updateTask(
      updatedTask,
      newReminders,
      historyEvent
    );
    await cancelNotificationIds(cancelledIds);

    await loadTasks(selectedDate);
  };

  const handleComplete = async (task: Task) => {
    const now = new Date();
    const { updatedTask, historyEvent } = completeTask(task, now);

    const cancelledIds = await TaskRepository.completeTask(updatedTask, historyEvent);
    await cancelNotificationIds(cancelledIds);
    triggerSuccessHaptic(settings.enableHaptics);

    await loadTasks(selectedDate);
    if (task.goalId) {
      await loadGoals();
    }
  };

  const handleSkip = async (task: Task, note?: string) => {
    const now = new Date();
    const { updatedTask, historyEvent } = skipTask(task, now, note);

    const cancelledIds = await TaskRepository.skipTask(updatedTask, historyEvent);
    await cancelNotificationIds(cancelledIds);
    triggerLightTapHaptic(settings.enableHaptics);

    await loadTasks(selectedDate);
    if (task.goalId) {
      await loadGoals();
    }
  };

  const handleReschedule = async (
    task: Task,
    newStartTime: string,
    newEndTime: string,
    note?: string
  ) => {
    const now = new Date();
    const { updatedTask, historyEvent } = rescheduleTask(task, newStartTime, newEndTime, now, note);

    const newReminders = await scheduleRemindersForTask(updatedTask, now, settings);

    const cancelledIds = await TaskRepository.rescheduleTask(
      updatedTask,
      newReminders,
      historyEvent
    );
    await cancelNotificationIds(cancelledIds);
    triggerSelectionHaptic(settings.enableHaptics);

    await loadTasks(selectedDate);
  };

  const handleDelete = async (taskId: string) => {
    const cancelledIds = await TaskRepository.deleteTask(taskId);
    await cancelNotificationIds(cancelledIds);
    await loadTasks(selectedDate);
    await loadGoals();
  };

  const handleCreateGoal = async (
    title: string,
    description: string | undefined,
    targetDays: number,
    preferredTime: string,
    durationMinutes: number,
    priority: TaskPriority = 'medium'
  ) => {
    const now = new Date();
    const [hoursStr, minsStr] = preferredTime.split(':');
    const startHour = parseInt(hoursStr, 10) || 8;
    const startMin = parseInt(minsStr, 10) || 0;

    const goalId = generateUUID();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    const goal: Goal = {
      id: goalId,
      title: title.trim(),
      description: description?.trim() || undefined,
      targetDays,
      startDate: startDate.toISOString().split('T')[0],
      preferredTime,
      durationMinutes,
      priority,
      createdAt: now.toISOString(),
    };

    const generatedTasks: Task[] = [];
    for (let day = 1; day <= targetDays; day++) {
      const taskDate = new Date(startDate);
      taskDate.setDate(taskDate.getDate() + (day - 1));
      taskDate.setHours(startHour, startMin, 0, 0);

      const endDate = new Date(taskDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      const taskId = generateUUID();
      const task: Task = {
        id: taskId,
        title: `[Day ${day}/${targetDays}] ${title.trim()}`,
        description: description?.trim()
          ? `${description.trim()} (Day ${day} of ${targetDays})`
          : `Milestone ${day} of ${targetDays} for target "${title.trim()}". Steady daily progression.`,
        startTime: taskDate.toISOString(),
        endTime: endDate.toISOString(),
        status: 'upcoming',
        priority,
        createdAt: now.toISOString(),
        completedAt: null,
        updatedAt: null,
        goalId: goal.id,
        goalDayNumber: day,
      };

      generatedTasks.push(task);
    }

    await TaskRepository.createGoal(goal, generatedTasks);
    await loadGoals();
    await loadTasks(selectedDate);
  };

  const handleDeleteGoal = async (goalId: string) => {
    const cancelledIds = await TaskRepository.deleteGoal(goalId);
    await cancelNotificationIds(cancelledIds);
    await loadGoals();
    await loadTasks(selectedDate);
  };

  const handleViewHistory = async (task: Task) => {
    const history = await TaskRepository.getTaskHistory(task.id);
    setTaskHistory(history);
    setHistoryModalTask(task);
  };

  const closeHistoryModal = () => {
    setHistoryModalTask(null);
    setTaskHistory([]);
  };

  const daySummary: DayProgressSummary = computeDaySummary(tasks);

  // Determine currently active task (if any)
  const activeTask = tasks.find((t) => t.status === 'in_progress') || null;

  return {
    selectedDate,
    setSelectedDate,
    tasks,
    goals,
    activeTask,
    loading,
    daySummary,
    historyModalTask,
    taskHistory,
    settings,
    handleUpdateSettings,
    reconcile,
    handleCreateTask,
    handleEditTask,
    handleComplete,
    handleSkip,
    handleReschedule,
    handleDelete,
    handleCreateGoal,
    handleDeleteGoal,
    loadGoals,
    handleViewHistory,
    closeHistoryModal,
    loadTasks,
  };
}
