import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { TaskPriority } from '../types/task';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreateGoal: (
    title: string,
    description: string | undefined,
    targetDays: number,
    preferredTime: string,
    durationMinutes: number,
    priority: TaskPriority
  ) => void;
}

const TARGET_DAYS_PRESETS = [
  { days: 7, label: '7 Days', sub: '1 Week' },
  { days: 14, label: '14 Days', sub: '2 Weeks' },
  { days: 21, label: '21 Days', sub: 'Habit' },
  { days: 30, label: '30 Days', sub: '1 Month' },
  { days: 60, label: '60 Days', sub: 'Transformation' },
  { days: 100, label: '100 Days', sub: 'Mastery' },
];

const DURATION_PRESETS = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 90, label: '1.5h' },
  { minutes: 120, label: '2h' },
];

export const CreateGoalModal: React.FC<Props> = ({
  visible,
  onClose,
  onCreateGoal,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDays, setTargetDays] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState<TaskPriority>('high');

  // Time Picker State (12h system with steppers)
  const [hour12, setHour12] = useState(8);
  const [minutes, setMinutes] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTargetDays(30);
    setDurationMinutes(60);
    setPriority('high');
    setHour12(8);
    setMinutes(0);
    setAmpm('AM');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Convert 12h + AM/PM to 24h "HH:mm"
  const formatted24hTime = useMemo(() => {
    let h24 = hour12 % 12;
    if (ampm === 'PM') h24 += 12;
    const hStr = h24 < 10 ? `0${h24}` : `${h24}`;
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hStr}:${mStr}`;
  }, [hour12, minutes, ampm]);

  const displayTime = useMemo(() => {
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hour12}:${mStr} ${ampm}`;
  }, [hour12, minutes, ampm]);

  const handleHourStep = (delta: number) => {
    let next = hour12 + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    setHour12(next);
  };

  const handleMinuteStep = (delta: number) => {
    let next = minutes + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    setMinutes(next);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Please enter a goal or target title.');
      return;
    }
    if (targetDays < 1 || targetDays > 365) {
      setError('Target days must be between 1 and 365.');
      return;
    }

    onCreateGoal(
      title.trim(),
      description.trim() || undefined,
      targetDays,
      formatted24hTime,
      durationMinutes,
      priority
    );

    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>🎯 New Target Goal</Text>
              <Text style={styles.headerSubtitle}>
                Break a major achievement into daily scheduled milestones
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Goal Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GOAL / TARGET OBJECTIVE *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Master Advanced Python, Morning 5km Run, Write Book"
                placeholderTextColor={theme.colors.textMuted}
                value={title}
                onChangeText={(val) => {
                  setTitle(val);
                  if (error) setError(null);
                }}
                maxLength={80}
              />
            </View>

            {/* Target Days Preset Chips */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>TIMELINE / TARGET HORIZON</Text>
                <Text style={styles.labelHighlight}>{targetDays} Days = {targetDays} Daily Tasks</Text>
              </View>

              <View style={styles.presetsGrid}>
                {TARGET_DAYS_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.days}
                    style={[
                      styles.dayChip,
                      targetDays === p.days && styles.dayChipActive,
                    ]}
                    onPress={() => setTargetDays(p.days)}
                  >
                    <Text
                      style={[
                        styles.dayChipLabel,
                        targetDays === p.days && styles.dayChipLabelActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipSub,
                        targetDays === p.days && styles.dayChipSubActive,
                      ]}
                    >
                      {p.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preferred Daily Focus Time */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>DAILY FOCUS TIME</Text>
                <Text style={styles.labelHighlight}>{displayTime} Daily</Text>
              </View>

              {/* Intuitive Stepper Controls */}
              <View style={styles.timeStepperContainer}>
                {/* Hour Stepper */}
                <View style={styles.stepperUnit}>
                  <Text style={styles.unitHeader}>HOUR</Text>
                  <View style={styles.stepperBox}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleHourStep(-1)}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.unitValue}>{hour12 < 10 ? `0${hour12}` : hour12}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleHourStep(1)}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.timeColon}>:</Text>

                {/* Minute Stepper */}
                <View style={styles.stepperUnit}>
                  <Text style={styles.unitHeader}>MINUTE</Text>
                  <View style={styles.stepperBox}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleMinuteStep(-15)}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.unitValue}>{minutes < 10 ? `0${minutes}` : minutes}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleMinuteStep(15)}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* AM / PM Segmented Switch */}
                <View style={styles.ampmWrapper}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, ampm === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setAmpm('AM')}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        ampm === 'AM' && styles.ampmBtnTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, ampm === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setAmpm('PM')}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        ampm === 'PM' && styles.ampmBtnTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Daily Session Duration */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>DAILY FOCUS DURATION</Text>
                <Text style={styles.labelHighlight}>{durationMinutes} minutes</Text>
              </View>
              <View style={styles.durationRow}>
                {DURATION_PRESETS.map((d) => (
                  <TouchableOpacity
                    key={d.minutes}
                    style={[
                      styles.durationPill,
                      durationMinutes === d.minutes && styles.durationPillActive,
                    ]}
                    onPress={() => setDurationMinutes(d.minutes)}
                  >
                    <Text
                      style={[
                        styles.durationPillText,
                        durationMinutes === d.minutes && styles.durationPillTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Priority Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PRIORITY LEVEL</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityBtn,
                        isSelected && styles.priorityBtnActive,
                        isSelected && { borderColor: theme.colors.priority[p] },
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityBtnText,
                          isSelected && { color: theme.colors.priority[p], fontWeight: 'bold' },
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Goal Blueprint Live Summary Card */}
            <View style={styles.blueprintCard}>
              <Text style={styles.blueprintTitle}>✨ GOAL BLUEPRINT SUMMARY</Text>
              <Text style={styles.blueprintBody}>
                Starting today, Kairo will generate <Text style={styles.boldText}>{targetDays} daily tasks</Text> (e.g. [Day 1/{targetDays}], [Day 2/{targetDays}]). Each session is scheduled at <Text style={styles.boldText}>{displayTime}</Text> for <Text style={styles.boldText}>{durationMinutes}m</Text>.
              </Text>
              <Text style={styles.blueprintQuote}>
                &ldquo;Success is the sum of small efforts, repeated day in and day out.&rdquo;
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>🚀 Schedule Goal ({targetDays} Days)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '92%',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : theme.colors.borderSubtle,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: 'bold',
    },
    scrollBody: {
      padding: theme.spacing.base,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      color: '#EF4444',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },
    inputGroup: {
      marginBottom: theme.spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textSecondary,
      letterSpacing: 0.6,
    },
    labelHighlight: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#A855F7',
    },
    textInput: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dayChip: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: theme.colors.surfaceSecondary,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    dayChipActive: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
      borderColor: '#A855F7',
    },
    dayChipLabel: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    dayChipLabelActive: {
      color: '#A855F7',
    },
    dayChipSub: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    dayChipSubActive: {
      color: isDark ? '#C084FC' : '#7E22CE',
    },
    timeStepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceSecondary,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    stepperUnit: {
      alignItems: 'center',
    },
    unitHeader: {
      fontSize: 9,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    stepperBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontSize: 18,
      color: theme.colors.textPrimary,
      fontWeight: 'bold',
      marginTop: -2,
    },
    unitValue: {
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.heavy,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      minWidth: 28,
      textAlign: 'center',
    },
    timeColon: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.colors.textMuted,
      marginTop: 10,
    },
    ampmWrapper: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      borderRadius: theme.radius.sm,
      padding: 2,
      marginTop: 12,
    },
    ampmBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.xs,
    },
    ampmBtnActive: {
      backgroundColor: '#A855F7',
    },
    ampmBtnText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textSecondary,
    },
    ampmBtnTextActive: {
      color: '#FFFFFF',
    },
    durationRow: {
      flexDirection: 'row',
      gap: 6,
    },
    durationPill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    durationPillActive: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
      borderColor: '#A855F7',
    },
    durationPillText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    durationPillTextActive: {
      color: '#A855F7',
      fontWeight: theme.typography.fontWeight.bold,
    },
    priorityRow: {
      flexDirection: 'row',
      gap: 8,
    },
    priorityBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    priorityBtnActive: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    },
    priorityBtnText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    blueprintCard: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : '#FAF5FF',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#E9D5FF',
      marginBottom: theme.spacing.lg,
    },
    blueprintTitle: {
      fontSize: 10,
      fontWeight: theme.typography.fontWeight.heavy,
      color: '#A855F7',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    blueprintBody: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textPrimary,
      lineHeight: 18,
    },
    boldText: {
      fontWeight: theme.typography.fontWeight.bold,
      color: '#A855F7',
    },
    blueprintQuote: {
      fontSize: 11,
      fontStyle: 'italic',
      color: theme.colors.textMuted,
      marginTop: 8,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    cancelButtonText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    submitButton: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      backgroundColor: '#9333EA',
      alignItems: 'center',
      shadowColor: '#9333EA',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    submitButtonText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
    },
  });

