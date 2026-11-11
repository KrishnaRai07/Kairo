import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useTasks } from './src/hooks/useTasks';
import { TaskRepository } from './src/database/taskRepository';
import { HeaderProgress } from './src/components/HeaderProgress';
import { CoachingBanner } from './src/components/CoachingBanner';
import { ActiveTaskHero } from './src/components/ActiveTaskHero';
import { TaskCard } from './src/components/TaskCard';
import { CreateTaskModal } from './src/components/CreateTaskModal';
import { EditTaskModal } from './src/components/EditTaskModal';
import { RescheduleModal } from './src/components/RescheduleModal';
import { HistoryModal } from './src/components/HistoryModal';
import { DeleteConfirmModal } from './src/components/DeleteConfirmModal';
import { InsightsView } from './src/components/InsightsView';
import { SettingsView } from './src/components/SettingsView';
import { CalendarPickerModal } from './src/components/CalendarPickerModal';
import { CreateGoalModal } from './src/components/CreateGoalModal';
import { GoalProgressCard } from './src/components/GoalProgressCard';
import { LockScreen } from './src/components/LockScreen';
import { LockType, Task } from './src/types/task';
import { getTheme } from './src/theme/theme';
import {
  getLockStatus,
  shouldLockAfterBackground,
} from './src/services/securityService';
import {
  findDueVoiceAlerts,
  speakTaskReminder,
  getVoiceAlertKey,
  VoiceTriggerType,
} from './src/services/voiceService';

type TabRoute = 'today' | 'schedule' | 'insights' | 'settings';

export default function App() {
  const {
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
  } = useTasks();

  const [activeTab, setActiveTab] = useState<TabRoute>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Task | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // Security / App Lock State
  const [securityReady, setSecurityReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [configuredLockType, setConfiguredLockType] = useState<LockType | null>(null);

  // Refs for background grace period, lock state & voice deduplication
  const lastBackgroundAtRef = useRef<number | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const settingsRef = useRef(settings);
  const tasksRef = useRef<Task[]>(tasks);
  const alreadySpokenKeysRef = useRef<Set<string>>(new Set());
  const pendingVoiceAlertRef = useRef<{
    title: string;
    trigger: VoiceTriggerType;
    key: string;
  } | null>(null);

  settingsRef.current = settings;
  tasksRef.current = tasks;
  isLockedRef.current = isLocked;

  const syncLockConfig = useCallback(async () => {
    try {
      const status = await getLockStatus();
      if (status.isConfigured && status.lockType) {
        setConfiguredLockType(status.lockType);
      } else {
        setConfiguredLockType(null);
        setIsLocked(false);
      }
    } catch {
      // Ignore lock status errors
    }
  }, []);

  // Initial security boot check before displaying sensitive schedule
  useEffect(() => {
    let mounted = true;
    async function bootSecurityCheck() {
      try {
        const [loadedSettings, lockStatus] = await Promise.all([
          TaskRepository.getSettings(),
          getLockStatus(),
        ]);
        if (!mounted) return;
        if (lockStatus.isConfigured && lockStatus.lockType) {
          setConfiguredLockType(lockStatus.lockType);
          if (loadedSettings.enableAppLock) {
            setIsLocked(true);
          }
        }
      } catch (e) {
        console.warn('Security boot check failed:', e);
      } finally {
        if (mounted) setSecurityReady(true);
      }
    }
    bootSecurityCheck();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to process voice trigger safely respecting App Lock
  const dispatchVoiceAlert = useCallback(
    (taskTitle: string, triggerType: VoiceTriggerType, alertKey: string) => {
      const currentSettings = settingsRef.current;
      if (currentSettings.enableVoiceAlerts === false) return;
      if (alreadySpokenKeysRef.current.has(alertKey)) return;

      alreadySpokenKeysRef.current.add(alertKey);
      if (isLockedRef.current) {
        pendingVoiceAlertRef.current = { title: taskTitle, trigger: triggerType, key: alertKey };
      } else {
        speakTaskReminder(taskTitle, triggerType, currentSettings);
      }
    },
    []
  );

  // Foreground notification arrival & lockscreen tap response listeners
  useEffect(() => {
    const handleNotifData = (data: any) => {
      if (!data || typeof data !== 'object') return;
      const { taskId, triggerType, taskTitle, startTime } = data;
      if (
        (triggerType === '15min_before' || triggerType === 'at_start') &&
        typeof taskId === 'string' &&
        typeof taskTitle === 'string'
      ) {
        const key = getVoiceAlertKey(taskId, triggerType, String(startTime || ''));
        dispatchVoiceAlert(taskTitle, triggerType, key);
      }
    };

    const fgSub = Notifications.addNotificationReceivedListener((notification) => {
      handleNotifData(notification.request.content.data);
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotifData(response.notification.request.content.data);
    });

    // Check cold start notification tap
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotifData(response.notification.request.content.data);
        }
      })
      .catch(() => {});

    return () => {
      fgSub.remove();
      tapSub.remove();
    };
  }, [dispatchVoiceAlert]);

  // Foreground Voice Alert Evaluator + Background Auto-Lock Grace Period Listener
  useEffect(() => {
    const checkDueVoice = () => {
      const due = findDueVoiceAlerts(
        tasksRef.current,
        new Date(),
        alreadySpokenKeysRef.current,
        settingsRef.current
      );
      for (const alert of due) {
        dispatchVoiceAlert(alert.taskTitle, alert.triggerType, alert.alertKey);
      }
    };

    checkDueVoice();
    const voiceInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkDueVoice();
      }
    }, 20000);

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastBackgroundAtRef.current = Date.now();
      } else if (nextState === 'active') {
        const currentSettings = settingsRef.current;
        if (currentSettings.enableAppLock && configuredLockType) {
          const timeoutSec = currentSettings.lockTimeoutSeconds ?? 60;
          if (shouldLockAfterBackground(lastBackgroundAtRef.current, Date.now(), timeoutSec)) {
            setIsLocked(true);
          }
        }
        checkDueVoice();
      }
    });

    return () => {
      clearInterval(voiceInterval);
      appStateSub.remove();
    };
  }, [configuredLockType, dispatchVoiceAlert]);

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    lastBackgroundAtRef.current = null;
    if (pendingVoiceAlertRef.current) {
      const pending = pendingVoiceAlertRef.current;
      pendingVoiceAlertRef.current = null;
      setTimeout(() => {
        speakTaskReminder(pending.title, pending.trigger, settingsRef.current);
      }, 300);
    }
  }, []);

  const isDark = settings.themeMode === 'dark';
  const activeTheme = getTheme(isDark ? 'dark' : 'light');

  const onRefresh = async () => {
    setRefreshing(true);
    await reconcile();
    setRefreshing(false);
  };

  // Group tasks for the current selected date
  const actionableTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'upcoming' || t.status === 'missed'
  );
  const resolvedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'skipped'
  );

  if (!securityReady) {
    return (
      <ThemeProvider mode={settings.themeMode}>
        <SafeAreaProvider>
          <View
            style={[
              styles.safeArea,
              {
                backgroundColor: activeTheme.colors.background,
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <ActivityIndicator size="large" color={activeTheme.colors.primary} />
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider mode={settings.themeMode} onModeChange={(mode) => handleUpdateSettings({ themeMode: mode })}>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: activeTheme.colors.surface }]}
          edges={['top', 'left', 'right']}
        >
        <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Main Top Header Bar */}
      <View
        style={[
          styles.appBar,
          {
            backgroundColor: activeTheme.colors.surface,
            borderBottomColor: activeTheme.colors.borderSubtle,
          },
        ]}
      >
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.appTitle, { color: activeTheme.colors.textPrimary }]}>Kairo</Text>
            <View style={styles.kairoBeacon} />
          </View>
          <Text style={[styles.appSubtitle, { color: activeTheme.colors.textSecondary }]}>
            Intentional Daily Flow
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newTaskButton, { backgroundColor: activeTheme.colors.primary }]}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.newTaskButtonText}>
            + New Task
          </Text>
        </TouchableOpacity>
      </View>

      {/* Primary Tab Content Area */}
      <View style={[styles.tabContentContainer, { backgroundColor: activeTheme.colors.background }]}>
        {activeTab === 'today' && (
          <ScrollView
            style={[styles.scrollContainer, { backgroundColor: activeTheme.colors.background }]}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={activeTheme.colors.primary}
              />
            }
          >
            {/* Daily Progress & Status Summary */}
            <HeaderProgress
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onOpenCalendar={() => setCalendarModalVisible(true)}
              summary={daySummary}
            />

            {/* Prominent Active Task Spotlight Card */}
            {activeTask && (
              <ActiveTaskHero
                activeTask={activeTask}
                onComplete={handleComplete}
                onReschedule={(t) => setRescheduleTarget(t)}
                onSkip={handleSkip}
                timeFormat={settings.timeFormat}
              />
            )}

            {/* Context-Aware Psychological Safety Coaching Banner */}
            <CoachingBanner summary={daySummary} />

            {/* Active Multi-Day Target Goal Momentum Tracker */}
            <GoalProgressCard
              goals={goals}
              onOpenCreateGoal={() => setCreateGoalModalVisible(true)}
              onDeleteGoal={handleDeleteGoal}
            />

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={activeTheme.colors.primary} />
                <Text style={[styles.loaderText, { color: activeTheme.colors.textSecondary }]}>
                  Syncing schedule...
                </Text>
              </View>
            ) : tasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🌱</Text>
                <Text style={[styles.emptyTitle, { color: activeTheme.colors.textPrimary }]}>
                  Nothing Scheduled
                </Text>
                <Text style={[styles.emptyText, { color: activeTheme.colors.textSecondary }]}>
                  Keep your focus balanced. Add a realistic intention to begin your flow.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyAddButton, { backgroundColor: activeTheme.colors.primary }]}
                  onPress={() => setCreateModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyAddButtonText}>
                    Schedule First Task
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Actionable / In-Flight Tasks */}
                {actionableTasks.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: activeTheme.colors.textSecondary }]}>
                      Today&apos;s Focus
                    </Text>
                    {actionableTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        onReschedule={(t) => setRescheduleTarget(t)}
                        onDelete={handleDelete}
                        onRequestDelete={(t) => setDeleteTarget(t)}
                        onEdit={(t) => setEditTarget(t)}
                        onViewHistory={handleViewHistory}
                        timeFormat={settings.timeFormat}
                      />
                    ))}
                  </View>
                )}

                {/* Resolved Section (Completed & Skipped) */}
                {resolvedTasks.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: activeTheme.colors.textSecondary }]}>
                      Completed & Skipped
                    </Text>
                    {resolvedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        onReschedule={(t) => setRescheduleTarget(t)}
                        onDelete={handleDelete}
                        onRequestDelete={(t) => setDeleteTarget(t)}
                        onEdit={(t) => setEditTarget(t)}
                        onViewHistory={handleViewHistory}
                        timeFormat={settings.timeFormat}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}

        {activeTab === 'schedule' && (
          <ScrollView
            style={[styles.scrollContainer, { backgroundColor: activeTheme.colors.background }]}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={activeTheme.colors.primary}
              />
            }
          >
            <HeaderProgress
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onOpenCalendar={() => setCalendarModalVisible(true)}
              summary={daySummary}
            />

            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: activeTheme.colors.textSecondary }]}>
                Daily Timeline ({tasks.length} total)
              </Text>
              {tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🗓️</Text>
                  <Text style={[styles.emptyTitle, { color: activeTheme.colors.textPrimary }]}>
                    No Tasks for this Date
                  </Text>
                  <Text style={[styles.emptyText, { color: activeTheme.colors.textSecondary }]}>
                    Tap + New Task above to schedule an intention.
                  </Text>
                </View>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    onReschedule={(t) => setRescheduleTarget(t)}
                    onDelete={handleDelete}
                    onRequestDelete={(t) => setDeleteTarget(t)}
                    onEdit={(t) => setEditTarget(t)}
                    onViewHistory={handleViewHistory}
                    timeFormat={settings.timeFormat}
                  />
                ))
              )}
            </View>
          </ScrollView>
        )}

        {activeTab === 'insights' && (
          <InsightsView tasks={tasks} selectedDate={selectedDate} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onDataReset={() => {
              reconcile();
              loadGoals();
              setActiveTab('today');
            }}
            onLockConfigChanged={syncLockConfig}
          />
        )}
      </View>

      {/* Floating Bottom Tab Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: activeTheme.colors.surface,
            borderTopColor: activeTheme.colors.borderSubtle,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'today' && styles.tabItemActive]}
          onPress={() => setActiveTab('today')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'today' && styles.tabIconActive]}>🎯</Text>
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'today' ? (isDark ? '#38BDF8' : activeTheme.colors.primary) : activeTheme.colors.textMuted },
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
          onPress={() => setActiveTab('schedule')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'schedule' && styles.tabIconActive]}>📅</Text>
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'schedule' ? (isDark ? '#38BDF8' : activeTheme.colors.primary) : activeTheme.colors.textMuted },
            ]}
          >
            Schedule
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'insights' && styles.tabItemActive]}
          onPress={() => setActiveTab('insights')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'insights' && styles.tabIconActive]}>📊</Text>
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'insights' ? (isDark ? '#38BDF8' : activeTheme.colors.primary) : activeTheme.colors.textMuted },
            ]}
          >
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>⚙️</Text>
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'settings' ? (isDark ? '#38BDF8' : activeTheme.colors.primary) : activeTheme.colors.textMuted },
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <CreateTaskModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateTask}
        selectedDate={selectedDate}
        timeFormat={settings.timeFormat}
        defaultDuration={settings.defaultDurationMinutes}
      />

      <EditTaskModal
        visible={!!editTarget}
        task={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditTask}
        timeFormat={settings.timeFormat}
      />

      <RescheduleModal
        visible={!!rescheduleTarget}
        task={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={handleReschedule}
        timeFormat={settings.timeFormat}
      />

      <HistoryModal
        visible={!!historyModalTask}
        task={historyModalTask}
        history={taskHistory}
        onClose={closeHistoryModal}
        timeFormat={settings.timeFormat}
      />

      <DeleteConfirmModal
        visible={!!deleteTarget}
        task={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <CalendarPickerModal
        visible={calendarModalVisible}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onClose={() => setCalendarModalVisible(false)}
      />

      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onCreateGoal={handleCreateGoal}
      />

      {isLocked && configuredLockType && (
        <LockScreen
          lockType={configuredLockType}
          enableBiometrics={settings.enableBiometrics ?? true}
          enableHaptics={settings.enableHaptics ?? true}
          onUnlock={handleUnlock}
        />
      )}
    </SafeAreaView>
  </SafeAreaProvider>
</ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kairoBeacon: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#38BDF8',
    marginTop: 2,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  newTaskButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14, // Pebble curve
  },
  newTaskButtonText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#FFFFFF',
  },
  tabContentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },
  emptyAddButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyAddButtonText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#FFFFFF',
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabItemActive: {
    transform: [{ scale: 1.05 }],
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.65,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
