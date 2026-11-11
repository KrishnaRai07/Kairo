import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Share,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { LockType, UserSettings } from '../types/task';
import { TaskRepository } from '../database/taskRepository';
import { testVoiceAssistant } from '../services/voiceService';
import {
  getLockStatus,
  clearAppLock,
  checkBiometricSupport,
} from '../services/securityService';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../services/hapticsService';
import { SecuritySetupModal } from './SecuritySetupModal';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onDataReset?: () => void;
  onLockConfigChanged?: () => void;
}

const DURATION_OPTIONS = [15, 25, 30, 45, 60, 90];
const DAY_START_OPTIONS = [
  { hour: 5, label: '05 AM' },
  { hour: 6, label: '06 AM' },
  { hour: 7, label: '07 AM' },
  { hour: 8, label: '08 AM' },
  { hour: 9, label: '09 AM' },
];
const LOCK_TIMEOUT_OPTIONS = [
  { seconds: 0, label: 'Immediate' },
  { seconds: 60, label: '1 Min Grace' },
  { seconds: 300, label: '5 Min Grace' },
];
interface VoiceLanguageOption {
  id: 'en-IN' | 'hi-IN' | 'en-US';
  label: string;
}

const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
  { id: 'en-IN', label: 'English (IN)' },
  { id: 'hi-IN', label: 'Hindi-Mix' },
  { id: 'en-US', label: 'English (US)' },
];

export const SettingsView: React.FC<Props> = ({
  settings,
  onUpdateSettings,
  onDataReset,
  onLockConfigChanged,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [stats, setStats] = useState({ taskCount: 0, historyCount: 0, reminderCount: 0 });
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Restore Modal State
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Security & Lock State
  const [lockConfigured, setLockConfigured] = useState(false);
  const [configuredLockType, setConfiguredLockType] = useState<LockType | undefined>(undefined);
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  const loadStorageStats = async () => {
    try {
      const s = await TaskRepository.getStorageStatistics();
      setStats(s);
    } catch (e) {
      console.warn('Failed to load storage stats:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initSettingsMetadata() {
      try {
        const [s, status, bio] = await Promise.all([
          TaskRepository.getStorageStatistics(),
          getLockStatus(),
          checkBiometricSupport(),
        ]);
        if (isMounted) {
          setStats(s);
          setLockConfigured(status.isConfigured);
          setConfiguredLockType(status.lockType);
          setBioAvailable(bio.available);
          setBioLabel(bio.label);
        }
      } catch (e) {
        console.warn('Failed to initialize settings state:', e);
      }
    }

    initSettingsMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLockSuccess = (lockType: LockType) => {
    setSetupModalVisible(false);
    setLockConfigured(true);
    setConfiguredLockType(lockType);
    onUpdateSettings({ enableAppLock: true });
    if (onLockConfigChanged) onLockConfigChanged();
  };

  const handleRemoveAppLock = () => {
    Alert.alert(
      'Disable App Lock?',
      'Remove PIN/password protection and clear your recovery questions from Kairo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable Lock',
          style: 'destructive',
          onPress: async () => {
            await clearAppLock();
            setLockConfigured(false);
            setConfiguredLockType(undefined);
            onUpdateSettings({ enableAppLock: false });
            if (onLockConfigChanged) onLockConfigChanged();
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      const data = await TaskRepository.exportAllData();
      const jsonString = JSON.stringify(data, null, 2);

      await Share.share({
        title: 'Kairo Backup Data',
        message: jsonString,
      });
      setExportNotice('Backup exported.');
      triggerSuccessHaptic(settings.enableHaptics);
      setTimeout(() => setExportNotice(null), 3000);
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Failed to export local data.');
    }
  };

  const handleExecuteRestore = async () => {
    try {
      setRestoreError(null);
      if (!importJsonText.trim()) {
        setRestoreError('Please paste your exported JSON backup string.');
        return;
      }

      const parsed = JSON.parse(importJsonText.trim());
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        setRestoreError('Invalid backup: "tasks" array not found.');
        return;
      }

      const result = await TaskRepository.importAllData(parsed);
      setRestoreModalVisible(false);
      setImportJsonText('');
      await loadStorageStats();
      triggerSuccessHaptic(settings.enableHaptics);
      if (onDataReset) onDataReset();

      Alert.alert('Restore Successful', `Restored ${result.importedTasks} tasks into Kairo.`);
    } catch (e: any) {
      setRestoreError(`Failed to parse or restore: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Reset All Data?',
      'This will erase all tasks, goals, history logs, and reminders. App Lock stays intact unless disabled separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await TaskRepository.clearAllData();
            await loadStorageStats();
            if (onDataReset) onDataReset();
          },
        },
      ]
    );
  };

  const formatLockTypeBadge = (t?: LockType) => {
    if (t === 'pin4') return '4-Digit PIN';
    if (t === 'pin6') return '6-Digit PIN';
    if (t === 'password') return 'Alphanumeric';
    return 'Configured';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Personalize voice alerts, security & workspace</Text>
      </View>

      {/* 1. Visual Aesthetic (2-Way Theme Switcher: Nordic Light & Obsidian Dark) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visual Aesthetic</Text>
        <View style={styles.themeRow}>
          <TouchableOpacity
            style={[
              styles.themeBtn,
              settings.themeMode === 'light' && styles.themeBtnActive,
            ]}
            onPress={() => {
              triggerSelectionHaptic(settings.enableHaptics);
              onUpdateSettings({ themeMode: 'light' });
            }}
          >
            <Text style={styles.themeEmoji}>🌱</Text>
            <Text
              style={[
                styles.themeBtnText,
                settings.themeMode === 'light' && styles.themeBtnTextActive,
              ]}
            >
              Nordic Light
            </Text>
            <Text style={styles.themeSubtext}>Warm daylight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeBtn,
              settings.themeMode === 'dark' && styles.themeBtnActive,
            ]}
            onPress={() => {
              triggerSelectionHaptic(settings.enableHaptics);
              onUpdateSettings({ themeMode: 'dark' });
            }}
          >
            <Text style={styles.themeEmoji}>⚡</Text>
            <Text
              style={[
                styles.themeBtnText,
                settings.themeMode === 'dark' && styles.themeBtnTextActive,
              ]}
            >
              Obsidian Dark
            </Text>
            <Text style={styles.themeSubtext}>High contrast</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Voice Coach & Spoken Reminders */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>🎙️ Voice Coach</Text>
          <Switch
            value={settings.enableVoiceAlerts ?? true}
            onValueChange={(val: boolean) => onUpdateSettings({ enableVoiceAlerts: val })}
            trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
          />
        </View>
        <Text style={styles.cardSubtitle}>
          Speaks reminders 15 min before & at start when active or tapped
        </Text>

        {(settings.enableVoiceAlerts ?? true) && (
          <>
            <View style={styles.salutationRow}>
              <Text style={styles.miniFieldLabel}>Call me:</Text>
              <TextInput
                style={styles.salutationInput}
                placeholder="Sir"
                placeholderTextColor={theme.colors.textMuted}
                value={settings.voiceSalutation ?? 'Sir'}
                onChangeText={(txt) => onUpdateSettings({ voiceSalutation: txt })}
                maxLength={24}
              />
            </View>

            <View style={styles.chipsRow}>
              {VOICE_LANGUAGE_OPTIONS.map((lang) => {
                const active = (settings.voiceLanguage || 'en-IN') === lang.id;
                return (
                  <TouchableOpacity
                    key={lang.id}
                    style={[styles.voiceChip, active && styles.durationChipActive]}
                    onPress={() => {
                      triggerSelectionHaptic(settings.enableHaptics);
                      onUpdateSettings({ voiceLanguage: lang.id });
                    }}
                  >
                    <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.previewVoiceBtn}
              onPress={() => testVoiceAssistant(settings)}
              activeOpacity={0.8}
            >
              <Text style={styles.previewVoiceBtnText}>🔊 Preview Voice Alert</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 3. Inbuilt App Lock & 5-Question Security */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>🔐 App Lock & Recovery</Text>
          {lockConfigured && settings.enableAppLock ? (
            <Text style={styles.activeBadge}>{formatLockTypeBadge(configuredLockType)}</Text>
          ) : (
            <Text style={styles.offBadge}>Off</Text>
          )}
        </View>
        <Text style={styles.cardSubtitle}>
          PIN or password protection with 5 recovery questions
        </Text>

        {!lockConfigured ? (
          <TouchableOpacity
            style={styles.setupLockBtn}
            onPress={() => setSetupModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.setupLockBtnText}>🔐 Setup PIN / Password Lock</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable App Lock</Text>
                <Text style={styles.settingDesc}>Require authentication on launch</Text>
              </View>
              <Switch
                value={settings.enableAppLock ?? false}
                onValueChange={(val: boolean) => {
                  onUpdateSettings({ enableAppLock: val });
                  if (onLockConfigChanged) onLockConfigChanged();
                }}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
              />
            </View>

            {bioAvailable && (
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{bioLabel} Unlock</Text>
                  <Text style={styles.settingDesc}>Quick unlock on compatible hardware</Text>
                </View>
                <Switch
                  value={settings.enableBiometrics ?? true}
                  onValueChange={(val: boolean) => onUpdateSettings({ enableBiometrics: val })}
                  trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
                />
              </View>
            )}

            <Text style={[styles.miniFieldLabel, { marginTop: 10, marginBottom: 6 }]}>
              Background Lock Grace Period
            </Text>
            <View style={styles.chipsRow}>
              {LOCK_TIMEOUT_OPTIONS.map((opt) => {
                const isSelected = (settings.lockTimeoutSeconds ?? 60) === opt.seconds;
                return (
                  <TouchableOpacity
                    key={opt.seconds}
                    style={[styles.voiceChip, isSelected && styles.durationChipActive]}
                    onPress={() => {
                      triggerSelectionHaptic(settings.enableHaptics);
                      onUpdateSettings({ lockTimeoutSeconds: opt.seconds });
                    }}
                  >
                    <Text
                      style={[styles.durationChipText, isSelected && styles.durationChipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.lockActionsRow}>
              <TouchableOpacity
                style={styles.changeLockBtn}
                onPress={() => setSetupModalVisible(true)}
              >
                <Text style={styles.changeLockBtnText}>🔑 Change PIN / Questions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeLockBtn}
                onPress={handleRemoveAppLock}
              >
                <Text style={styles.removeLockBtnText}>Disable</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* 4. Notification Reminders */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔔 Reminders</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>15-Min Pre-Focus Alert</Text>
          </View>
          <Switch
            value={settings.enable15MinReminder}
            onValueChange={(val: boolean) => onUpdateSettings({ enable15MinReminder: val })}
            trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>At-Start Launch Alert</Text>
          </View>
          <Switch
            value={settings.enableStartReminder}
            onValueChange={(val: boolean) => onUpdateSettings({ enableStartReminder: val })}
            trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Overdue Check-in Alert</Text>
          </View>
          <Switch
            value={settings.enableOverdueReminder}
            onValueChange={(val: boolean) => onUpdateSettings({ enableOverdueReminder: val })}
            trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
          />
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Haptic Vibration Feedback</Text>
          </View>
          <Switch
            value={settings.enableHaptics ?? true}
            onValueChange={(val: boolean) => onUpdateSettings({ enableHaptics: val })}
            trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
          />
        </View>
      </View>

      {/* 5. Focus & Schedule Preferences */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>⏱️ Schedule Defaults</Text>
          <Text style={styles.highlightBadge}>{settings.defaultDurationMinutes}m block</Text>
        </View>

        <Text style={[styles.miniFieldLabel, { marginTop: 8, marginBottom: 6 }]}>Default Duration</Text>
        <View style={styles.chipsRow}>
          {DURATION_OPTIONS.map((mins) => {
            const isSelected = settings.defaultDurationMinutes === mins;
            return (
              <TouchableOpacity
                key={mins}
                style={[styles.durationChip, isSelected && styles.durationChipActive]}
                onPress={() => {
                  triggerSelectionHaptic(settings.enableHaptics);
                  onUpdateSettings({ defaultDurationMinutes: mins });
                }}
              >
                <Text style={[styles.durationChipText, isSelected && styles.durationChipTextActive]}>
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.miniFieldLabel, { marginTop: 12, marginBottom: 6 }]}>Day Starts At</Text>
        <View style={styles.chipsRow}>
          {DAY_START_OPTIONS.map((opt) => {
            const isSelected = settings.dayStartHour === opt.hour;
            return (
              <TouchableOpacity
                key={opt.hour}
                style={[styles.routineChip, isSelected && styles.durationChipActive]}
                onPress={() => {
                  triggerSelectionHaptic(settings.enableHaptics);
                  onUpdateSettings({ dayStartHour: opt.hour });
                }}
              >
                <Text style={[styles.durationChipText, isSelected && styles.durationChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.miniFieldLabel, { marginTop: 12, marginBottom: 6 }]}>Time Display</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[
              styles.formatBtn,
              settings.timeFormat === '12h' && styles.formatBtnActive,
            ]}
            onPress={() => onUpdateSettings({ timeFormat: '12h' })}
          >
            <Text
              style={[
                styles.formatBtnText,
                settings.timeFormat === '12h' && styles.formatBtnTextActive,
              ]}
            >
              12-Hour
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.formatBtn,
              settings.timeFormat === '24h' && styles.formatBtnActive,
            ]}
            onPress={() => onUpdateSettings({ timeFormat: '24h' })}
          >
            <Text
              style={[
                styles.formatBtnText,
                settings.timeFormat === '24h' && styles.formatBtnTextActive,
              ]}
            >
              24-Hour
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. Local Storage & Backup */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💾 Local Backup & Data</Text>
        <Text style={styles.cardSubtitle}>100% offline SQLite storage on your device</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.taskCount}</Text>
            <Text style={styles.statText}>Tasks</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.historyCount}</Text>
            <Text style={styles.statText}>Logs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.reminderCount}</Text>
            <Text style={styles.statText}>Alerts</Text>
          </View>
        </View>

        {exportNotice && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>✓ {exportNotice}</Text>
          </View>
        )}

        <View style={styles.buttonStack}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportData}
            activeOpacity={0.8}
          >
            <Text style={styles.exportBtnText}>📤 Export JSON Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => setRestoreModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.restoreBtnText}>📥 Restore / Import Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleClearAll}
            activeOpacity={0.8}
          >
            <Text style={styles.resetBtnText}>⚠️ Clear All Local Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About Box */}
      <View style={styles.aboutCard}>
        <View style={styles.aboutHeaderRow}>
          <Text style={styles.aboutTitle}>Kairo</Text>
          <View style={styles.kairoDot} />
        </View>
        <Text style={styles.aboutVersion}>v1.1.0 • Master your daily flow. Without the guilt.</Text>
      </View>

      {/* Security Setup Modal */}
      <SecuritySetupModal
        visible={setupModalVisible}
        enableHaptics={settings.enableHaptics}
        onClose={() => setSetupModalVisible(false)}
        onSuccess={handleLockSuccess}
      />

      {/* Restore Backup Modal */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRestoreModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📥 Restore Backup</Text>
              <TouchableOpacity
                onPress={() => setRestoreModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Paste your exported Kairo JSON backup string below:
            </Text>

            {restoreError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {restoreError}</Text>
              </View>
            )}

            <TextInput
              style={styles.jsonInput}
              multiline
              placeholder='{"tasks": [...], "history": [...]}'
              placeholderTextColor={theme.colors.textMuted}
              value={importJsonText}
              onChangeText={setImportJsonText}
              textAlignVertical="top"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRestoreModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleExecuteRestore}
              >
                <Text style={styles.modalConfirmText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.base,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      ...theme.shadows.card,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    highlightBadge: {
      fontSize: 10,
      fontWeight: 'bold',
      color: theme.colors.primary,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    activeBadge: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    offBadge: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      backgroundColor: theme.colors.surfaceSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    cardSubtitle: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginBottom: 10,
    },
    themeRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    themeBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
    },
    themeBtnActive: {
      borderColor: theme.colors.primary,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)',
    },
    themeEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },
    themeBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    themeBtnTextActive: {
      color: theme.colors.primary,
    },
    themeSubtext: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    salutationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    miniFieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    salutationInput: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.sm,
      paddingVertical: 7,
      paddingHorizontal: 10,
      fontSize: 13,
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    voiceChip: {
      flex: 1,
      minWidth: '28%',
      paddingVertical: 8,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
    },
    previewVoiceBtn: {
      marginTop: 10,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(56, 189, 248, 0.1)',
      borderWidth: 1,
      borderColor: '#38BDF8',
      alignItems: 'center',
    },
    previewVoiceBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#38BDF8',
    },
    setupLockBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 2,
    },
    setupLockBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    lockActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    changeLockBtn: {
      flex: 2,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    changeLockBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    removeLockBtn: {
      flex: 1,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    removeLockBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#EF4444',
    },
    durationChip: {
      flex: 1,
      minWidth: '14%',
      paddingVertical: 8,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
    },
    routineChip: {
      flex: 1,
      minWidth: '17%',
      paddingVertical: 8,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
    },
    durationChipActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.1)',
      borderColor: theme.colors.primary,
    },
    durationChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    durationChipTextActive: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    formatRow: {
      flexDirection: 'row',
      gap: 8,
    },
    formatBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
    },
    formatBtnActive: {
      borderColor: theme.colors.primary,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)',
    },
    formatBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    formatBtnTextActive: {
      color: theme.colors.primary,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.borderSubtle,
    },
    settingInfo: {
      flex: 1,
      marginRight: 10,
    },
    settingLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    settingDesc: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 8,
    },
    statBox: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 8,
      alignItems: 'center',
    },
    statNum: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    statText: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    noticeBox: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: theme.radius.md,
      padding: 8,
      marginBottom: 10,
    },
    noticeText: {
      color: '#10B981',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    buttonStack: {
      gap: 8,
    },
    exportBtn: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    exportBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    restoreBtn: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.borderSubtle,
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    restoreBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    resetBtn: {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    resetBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#EF4444',
    },
    aboutCard: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    aboutHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    kairoDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#38BDF8',
    },
    aboutTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    aboutVersion: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      padding: theme.spacing.base,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.borderSubtle,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.colors.textPrimary,
    },
    modalCloseText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
      fontWeight: 'bold',
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 12,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      padding: 8,
      borderRadius: theme.radius.sm,
      marginBottom: 10,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 11,
    },
    jsonInput: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 12,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      height: 150,
      marginBottom: 14,
    },
    modalActionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    modalConfirmBtn: {
      flex: 1.5,
      paddingVertical: 11,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
    },
    modalConfirmText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
  });
