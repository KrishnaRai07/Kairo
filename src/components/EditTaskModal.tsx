import React, { useState, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Task, TaskPriority } from '../types/task';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';
import { formatTime, formatDuration, validateTaskSchedule } from '../utils/dateUtils';

interface Props {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (
    task: Task,
    updates: {
      title: string;
      description?: string;
      priority: TaskPriority;
      startTime: string;
      endTime: string;
    }
  ) => void;
  timeFormat?: '12h' | '24h';
}

interface ContentProps extends Omit<Props, 'task'> {
  task: Task;
}

function getInitialEditTimeState(task: Task, timeFormat: '12h' | '24h') {
  const start = new Date(task.startTime);
  const end = new Date(task.endTime);
  const diffMins = Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));

  const hours = start.getHours();
  const minutes = start.getMinutes();

  if (timeFormat === '12h') {
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;
    return {
      durationMinutes: diffMins,
      startHour: h12,
      startMinute: minutes,
      isPM: hours >= 12,
    };
  }

  return {
    durationMinutes: diffMins,
    startHour: hours,
    startMinute: minutes,
    isPM: false,
  };
}

export const EditTaskModal: React.FC<Props> = (props) => {
  if (!props.visible || !props.task) return null;

  return (
    <EditTaskModalContent
      key={`${props.task.id}_${props.task.updatedAt || props.task.startTime}_${props.timeFormat || '12h'}`}
      visible={props.visible}
      task={props.task}
      onClose={props.onClose}
      onSave={props.onSave}
      timeFormat={props.timeFormat}
    />
  );
};

const EditTaskModalContent: React.FC<ContentProps> = ({
  visible,
  task,
  onClose,
  onSave,
  timeFormat = '12h',
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [initialTime] = useState(() => getInitialEditTimeState(task, timeFormat));

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [startTime, setStartTime] = useState(task.startTime);
  const [endTime, setEndTime] = useState(task.endTime);
  const [startHour, setStartHour] = useState<number>(initialTime.startHour);
  const [startMinute, setStartMinute] = useState<number>(initialTime.startMinute);
  const [isPM, setIsPM] = useState<boolean>(initialTime.isPM);
  const [durationMinutes, setDurationMinutes] = useState<number>(initialTime.durationMinutes);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync new start hour/min or duration to startTime & endTime
  const updateTimesFromState = (h: number, m: number, pm: boolean, durMins: number) => {
    const base = new Date(startTime || task.startTime);
    let h24 = h;
    if (timeFormat === '12h') {
      if (pm && h < 12) h24 = h + 12;
      if (!pm && h === 12) h24 = 0;
    }
    base.setHours(h24, m, 0, 0);

    const newStartIso = base.toISOString();
    const newEndIso = new Date(base.getTime() + durMins * 60 * 1000).toISOString();
    setStartTime(newStartIso);
    setEndTime(newEndIso);
  };

  const handleHourStep = (delta: number) => {
    let next = startHour;
    if (timeFormat === '12h') {
      next = startHour + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
    } else {
      next = (startHour + delta + 24) % 24;
    }
    setStartHour(next);
    updateTimesFromState(next, startMinute, isPM, durationMinutes);
    setErrorMessage(null);
  };

  const handleMinuteStep = (delta: number) => {
    let next = startMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    setStartMinute(next);
    updateTimesFromState(startHour, next, isPM, durationMinutes);
    setErrorMessage(null);
  };

  const handleDirectHour = (h: number) => {
    setStartHour(h);
    updateTimesFromState(h, startMinute, isPM, durationMinutes);
    setErrorMessage(null);
  };

  const handleDirectMinute = (m: number) => {
    setStartMinute(m);
    updateTimesFromState(startHour, m, isPM, durationMinutes);
    setErrorMessage(null);
  };

  const handleAmPmToggle = (pm: boolean) => {
    setIsPM(pm);
    updateTimesFromState(startHour, startMinute, pm, durationMinutes);
    setErrorMessage(null);
  };

  const handleSetDuration = (mins: number) => {
    setDurationMinutes(mins);
    updateTimesFromState(startHour, startMinute, isPM, mins);
    setErrorMessage(null);
  };

  const handleShiftTime = (shiftMinutes: number) => {
    const startMs = new Date(startTime).getTime() + shiftMinutes * 60 * 1000;
    const endMs = new Date(endTime).getTime() + shiftMinutes * 60 * 1000;
    const newStart = new Date(startMs);
    const newEnd = new Date(endMs);

    setStartTime(newStart.toISOString());
    setEndTime(newEnd.toISOString());

    const hours = newStart.getHours();
    const minutes = newStart.getMinutes();
    if (timeFormat === '12h') {
      setIsPM(hours >= 12);
      let h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      setStartHour(h12);
    } else {
      setStartHour(hours);
    }
    setStartMinute(minutes);
    setErrorMessage(null);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Task title cannot be empty.');
      return;
    }

    if (trimmedTitle.length > 100) {
      setErrorMessage('Task title cannot exceed 100 characters.');
      return;
    }

    const validation = validateTaskSchedule(startTime, endTime);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid task schedule.');
      return;
    }

    onSave(task, {
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      startTime,
      endTime,
    });
    onClose();
  };

  const formattedStartDisplay =
    timeFormat === '12h'
      ? `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`
      : `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Edit Task Details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Title */}
            <Text style={styles.label}>Task Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Deep Work: Refactor status engine"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={(text: string) => {
                setTitle(text);
                if (errorMessage) setErrorMessage(null);
              }}
              maxLength={100}
            />

            {/* Description */}
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Deliverables, reference links, notes..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              maxLength={500}
            />

            {/* Priority Selector */}
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityBtn,
                      isSelected && styles.priorityBtnSelected,
                      isSelected && p === 'high' && { backgroundColor: theme.colors.priority.high },
                      isSelected && p === 'medium' && { backgroundColor: theme.colors.priority.medium },
                      isSelected && p === 'low' && { backgroundColor: theme.colors.priority.low },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        isSelected && styles.priorityTextSelected,
                      ]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Exact Manual Time Adjustment Card */}
            <Text style={styles.label}>Start Time (Manual Adjust)</Text>
            <View style={styles.manualTimeCard}>
              <Text style={styles.manualCardHeader}>Selected Start Time</Text>
              <Text style={styles.largeTimeDisplay}>{formattedStartDisplay}</Text>

              {/* Hour Stepper & AM/PM */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Hour</Text>
                <View style={styles.stepperButtonGroup}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => handleHourStep(-1)}>
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{String(startHour).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => handleHourStep(1)}>
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {timeFormat === '12h' && (
                  <View style={styles.ampmGroup}>
                    <TouchableOpacity
                      style={[styles.ampmBtn, !isPM && styles.ampmBtnActive]}
                      onPress={() => handleAmPmToggle(false)}
                    >
                      <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}
                      onPress={() => handleAmPmToggle(true)}
                    >
                      <Text style={[styles.ampmText, isPM && styles.ampmTextActive]}>PM</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 12-Hour Direct Number Pad */}
              {timeFormat === '12h' && (
                <View style={styles.hourGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.hourPill, startHour === num && styles.hourPillActive]}
                      onPress={() => handleDirectHour(num)}
                    >
                      <Text
                        style={[
                          styles.hourPillText,
                          startHour === num && styles.hourPillTextActive,
                        ]}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Minute Stepper & Quick Minutes */}
              <View style={[styles.stepperRow, { marginTop: 12 }]}>
                <Text style={styles.stepperLabel}>Minute</Text>
                <View style={styles.stepperButtonGroup}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => handleMinuteStep(-5)}>
                    <Text style={styles.stepperBtnText}>−5</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>:{String(startMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => handleMinuteStep(5)}>
                    <Text style={styles.stepperBtnText}>+5</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.quickMinuteRow}>
                  {[0, 15, 30, 45].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.minuteQuickBtn,
                        startMinute === m && styles.minuteQuickBtnActive,
                      ]}
                      onPress={() => handleDirectMinute(m)}
                    >
                      <Text
                        style={[
                          styles.minuteQuickText,
                          startMinute === m && styles.minuteQuickTextActive,
                        ]}
                      >
                        :{String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Block Duration Selection */}
            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.durationChip,
                    durationMinutes === mins && styles.durationChipActive,
                  ]}
                  onPress={() => handleSetDuration(mins)}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      durationMinutes === mins && styles.durationChipTextActive,
                    ]}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Shift Presets */}
            <Text style={styles.subLabel}>Relative Schedule Shift</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity style={styles.presetBtn} onPress={() => handleShiftTime(-15)}>
                <Text style={styles.presetBtnText}>-15m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => handleShiftTime(15)}>
                <Text style={styles.presetBtnText}>+15m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => handleShiftTime(30)}>
                <Text style={styles.presetBtnText}>+30m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => handleShiftTime(60)}>
                <Text style={styles.presetBtnText}>+1h</Text>
              </TouchableOpacity>
            </View>

            {/* Current Resulting Window */}
            <View style={styles.schedulePreview}>
              <View>
                <Text style={styles.schedulePreviewLabel}>Updated Execution Window</Text>
                <Text style={styles.scheduleText}>
                  {formatTime(startTime, timeFormat)} – {formatTime(endTime, timeFormat)}
                </Text>
              </View>
              <Text style={styles.durationBadge}>{formatDuration(startTime, endTime)}</Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '92%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      ...theme.shadows.modal,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    sheetTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    closeBtn: {
      fontSize: 20,
      color: theme.colors.textMuted,
      padding: 4,
    },
    scrollArea: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    errorBox: {
      backgroundColor: theme.colors.status.dangerBg,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.status.dangerBorder,
    },
    errorText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.status.danger,
      fontWeight: theme.typography.fontWeight.medium,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.md,
    },
    subLabel: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 10,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
    },
    multilineInput: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    priorityRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    priorityBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    priorityBtnSelected: {
      borderColor: 'transparent',
    },
    priorityText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    priorityTextSelected: {
      color: '#FFFFFF',
    },
    manualTimeCard: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginTop: 4,
    },
    manualCardHeader: {
      fontSize: 10,
      fontWeight: theme.typography.fontWeight.heavy,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
      marginBottom: 2,
    },
    largeTimeDisplay: {
      fontSize: 28,
      fontWeight: theme.typography.fontWeight.heavy,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 1,
      marginBottom: 12,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepperLabel: {
      fontSize: 12,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      width: 50,
    },
    stepperButtonGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnText: {
      fontSize: 16,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    stepperValue: {
      fontSize: 16,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      minWidth: 32,
      textAlign: 'center',
    },
    ampmGroup: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      padding: 2,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    ampmBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius.xs,
    },
    ampmBtnActive: {
      backgroundColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    ampmText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textMuted,
    },
    ampmTextActive: {
      color: '#FFFFFF',
    },
    hourGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
      justifyContent: 'space-between',
    },
    hourPill: {
      width: '14.5%',
      paddingVertical: 6,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    hourPillActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : theme.colors.primaryTint,
      borderColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    hourPillText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    hourPillTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    quickMinuteRow: {
      flexDirection: 'row',
      gap: 6,
    },
    minuteQuickBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    minuteQuickBtnActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : theme.colors.primaryTint,
      borderColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    minuteQuickText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    minuteQuickTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    durationRow: {
      flexDirection: 'row',
      gap: 6,
    },
    durationChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    durationChipActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : theme.colors.primaryTint,
      borderColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    durationChipText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    durationChipTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    presetRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    presetBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    presetBtnText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    schedulePreview: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : theme.colors.primaryTint,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : theme.colors.borderSubtle,
    },
    schedulePreviewLabel: {
      fontSize: 10,
      color: isDark ? '#94A3B8' : theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.heavy,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    scheduleText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0.5,
    },
    durationBadge: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    sheetFooter: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
    },
    cancelBtn: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceSecondary,
    },
    cancelBtnText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    saveBtn: {
      flex: 2,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    saveBtnText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
    },
  });
