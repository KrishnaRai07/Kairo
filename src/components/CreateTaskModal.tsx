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
import { TaskPriority } from '../types/task';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';
import { formatTime, formatDuration, validateTaskSchedule, isToday } from '../utils/dateUtils';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    description: string | undefined,
    startTime: string,
    endTime: string,
    priority: TaskPriority
  ) => void;
  selectedDate: Date;
  timeFormat?: '12h' | '24h';
  defaultDuration?: number;
}

function getInitialTimeState(selectedDate: Date, timeFormat: '12h' | '24h') {
  if (isToday(selectedDate)) {
    const now = new Date();
    const curM = now.getMinutes();
    const roundedM = Math.ceil((curM + 5) / 15) * 15;
    const curH = now.getHours() + Math.floor(roundedM / 60);
    const finalM = roundedM % 60;
    const finalH = curH % 24;

    if (timeFormat === '12h') {
      let h12 = finalH % 12;
      if (h12 === 0) h12 = 12;
      return { startHour: h12, startMinute: finalM, isPM: finalH >= 12 };
    }
    return { startHour: finalH, startMinute: finalM, isPM: false };
  }

  return { startHour: 9, startMinute: 0, isPM: false };
}

export const CreateTaskModal: React.FC<Props> = (props) => {
  if (!props.visible) return null;

  return (
    <CreateTaskModalContent
      key={`${props.selectedDate.toISOString()}_${props.timeFormat || '12h'}`}
      {...props}
    />
  );
};

const CreateTaskModalContent: React.FC<Props> = ({
  visible,
  onClose,
  onCreate,
  selectedDate,
  timeFormat = '12h',
  defaultDuration = 45,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [initialTime] = useState(() => getInitialTimeState(selectedDate, timeFormat));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultDuration);
  const [scheduleMode, setScheduleMode] = useState<'manual' | 'preset'>('manual');
  const [startHour, setStartHour] = useState<number>(initialTime.startHour);
  const [startMinute, setStartMinute] = useState<number>(initialTime.startMinute);
  const [isPM, setIsPM] = useState<boolean>(initialTime.isPM);
  const [timePreset, setTimePreset] = useState<'now' | 'in15m' | 'in30m' | 'nextHour'>('now');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const computeTimes = () => {
    const start = new Date(selectedDate);
    const now = new Date();

    if (scheduleMode === 'preset') {
      if (isToday(selectedDate)) {
        start.setHours(now.getHours(), now.getMinutes(), 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      if (timePreset === 'in15m') start.setMinutes(start.getMinutes() + 15);
      else if (timePreset === 'in30m') start.setMinutes(start.getMinutes() + 30);
      else if (timePreset === 'nextHour') start.setHours(start.getHours() + 1, 0, 0, 0);
    } else {
      let h24 = startHour;
      if (timeFormat === '12h') {
        if (isPM && startHour < 12) h24 = startHour + 12;
        if (!isPM && startHour === 12) h24 = 0;
      }
      start.setHours(h24, startMinute, 0, 0);
    }

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  };

  const preview = computeTimes();

  const handleHourStep = (delta: number) => {
    if (timeFormat === '12h') {
      let next = startHour + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      setStartHour(next);
    } else {
      let next = (startHour + delta + 24) % 24;
      setStartHour(next);
    }
    setErrorMessage(null);
  };

  const handleMinuteStep = (delta: number) => {
    let next = startMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    setStartMinute(next);
    setErrorMessage(null);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a task title.');
      return;
    }

    if (trimmedTitle.length > 100) {
      setErrorMessage('Task title cannot exceed 100 characters.');
      return;
    }

    const { startTime, endTime } = computeTimes();
    const validation = validateTaskSchedule(startTime, endTime);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid schedule window.');
      return;
    }

    onCreate(trimmedTitle, description.trim() || undefined, startTime, endTime, priority);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDurationMinutes(defaultDuration);
    setErrorMessage(null);
    onClose();
  };

  const dayPresets =
    timeFormat === '12h'
      ? [
          { label: '08:00 AM', h: 8, m: 0, pm: false },
          { label: '09:30 AM', h: 9, m: 30, pm: false },
          { label: '11:00 AM', h: 11, m: 0, pm: false },
          { label: '01:00 PM', h: 1, m: 0, pm: true },
          { label: '02:30 PM', h: 2, m: 30, pm: true },
          { label: '04:00 PM', h: 4, m: 0, pm: true },
          { label: '06:00 PM', h: 6, m: 0, pm: true },
          { label: '08:00 PM', h: 8, m: 0, pm: true },
        ]
      : [
          { label: '08:00', h: 8, m: 0, pm: false },
          { label: '09:30', h: 9, m: 30, pm: false },
          { label: '11:00', h: 11, m: 0, pm: false },
          { label: '13:00', h: 13, m: 0, pm: false },
          { label: '14:30', h: 14, m: 30, pm: false },
          { label: '16:00', h: 16, m: 0, pm: false },
          { label: '18:00', h: 18, m: 0, pm: false },
          { label: '20:00', h: 20, m: 0, pm: false },
        ];

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
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Schedule New Task</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Task Title */}
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
              placeholder="Key deliverables, context, or notes..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              maxLength={500}
            />

            {/* Mode Selector */}
            <Text style={styles.label}>Time Selection Mode</Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeToggleBtn, scheduleMode === 'manual' && styles.modeToggleBtnActive]}
                onPress={() => setScheduleMode('manual')}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    scheduleMode === 'manual' && styles.modeToggleTextActive,
                  ]}
                >
                  🕒 Exact Time (Day Planning)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeToggleBtn, scheduleMode === 'preset' && styles.modeToggleBtnActive]}
                onPress={() => setScheduleMode('preset')}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    scheduleMode === 'preset' && styles.modeToggleTextActive,
                  ]}
                >
                  ⚡ Relative to Now
                </Text>
              </TouchableOpacity>
            </View>

            {scheduleMode === 'manual' ? (
              <>
                {/* Day Segment Quick Picks */}
                <Text style={styles.subLabel}>Quick Day Slots (1-Tap Select)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                  {dayPresets.map((slot) => {
                    const isSelected =
                      startHour === slot.h && startMinute === slot.m && isPM === slot.pm;
                    return (
                      <TouchableOpacity
                        key={slot.label}
                        style={[styles.slotChip, isSelected && styles.slotChipActive]}
                        onPress={() => {
                          setStartHour(slot.h);
                          setStartMinute(slot.m);
                          setIsPM(slot.pm);
                        }}
                      >
                        <Text style={[styles.slotChipText, isSelected && styles.slotChipTextActive]}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Interactive Time Adjuster Card */}
                <View style={styles.manualTimeCard}>
                  <Text style={styles.manualCardHeader}>Selected Start Time</Text>
                  <Text style={styles.largeTimeDisplay}>{formattedStartDisplay}</Text>

                  {/* Hour Controls */}
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
                          onPress={() => setIsPM(false)}
                        >
                          <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>AM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}
                          onPress={() => setIsPM(true)}
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
                          onPress={() => setStartHour(num)}
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

                  {/* Minute Controls */}
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
                          onPress={() => setStartMinute(m)}
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
              </>
            ) : (
              /* Relative to Now Presets */
              <View style={styles.presetSection}>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={[styles.presetBtn, timePreset === 'now' && styles.presetBtnActive]}
                    onPress={() => setTimePreset('now')}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        timePreset === 'now' && styles.presetBtnTextActive,
                      ]}
                    >
                      Now
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, timePreset === 'in15m' && styles.presetBtnActive]}
                    onPress={() => setTimePreset('in15m')}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        timePreset === 'in15m' && styles.presetBtnTextActive,
                      ]}
                    >
                      +15 Mins
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, timePreset === 'in30m' && styles.presetBtnActive]}
                    onPress={() => setTimePreset('in30m')}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        timePreset === 'in30m' && styles.presetBtnTextActive,
                      ]}
                    >
                      +30 Mins
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, timePreset === 'nextHour' && styles.presetBtnActive]}
                    onPress={() => setTimePreset('nextHour')}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        timePreset === 'nextHour' && styles.presetBtnTextActive,
                      ]}
                    >
                      Next Hour
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Duration Selector */}
            <Text style={styles.label}>Block Duration</Text>
            <View style={styles.durationRow}>
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.durationChip,
                    durationMinutes === mins && styles.durationChipActive,
                  ]}
                  onPress={() => setDurationMinutes(mins)}
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

            {/* Priority Selector */}
            <Text style={styles.label}>Priority</Text>
            <View style={styles.presetRow}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.presetBtn,
                      isSelected && styles.presetBtnActive,
                      isSelected && p === 'high' && { backgroundColor: theme.colors.priority.high },
                      isSelected && p === 'medium' && { backgroundColor: theme.colors.priority.medium },
                      isSelected && p === 'low' && { backgroundColor: theme.colors.priority.low },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        isSelected && styles.presetBtnTextActive,
                      ]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Live Schedule Window Preview */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Scheduled Execution Window</Text>
              <Text style={styles.previewTimes}>
                {formatTime(preview.startTime, timeFormat)} – {formatTime(preview.endTime, timeFormat)} ({formatDuration(preview.startTime, preview.endTime)})
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>Schedule Task</Text>
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
      marginTop: 8,
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
    modeToggleRow: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 3,
      gap: 4,
      marginBottom: 4,
    },
    modeToggleBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: theme.radius.sm,
    },
    modeToggleBtnActive: {
      backgroundColor: isDark ? '#1E293B' : theme.colors.surface,
      ...theme.shadows.subtle,
    },
    modeToggleText: {
      fontSize: 12,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textMuted,
    },
    modeToggleTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    horizontalChips: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    slotChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginRight: 6,
    },
    slotChipActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : theme.colors.primaryTint,
      borderColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    slotChipText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    slotChipTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
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
    presetSection: {
      marginVertical: 4,
    },
    presetRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    presetBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetBtnActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : theme.colors.primaryTint,
      borderColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    presetBtnText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    presetBtnTextActive: {
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
    previewBox: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : theme.colors.primaryTint,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : theme.colors.borderSubtle,
    },
    previewLabel: {
      fontSize: 10,
      color: isDark ? '#94A3B8' : theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.heavy,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    previewTimes: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0.5,
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
    submitBtn: {
      flex: 2,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    submitBtnText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
    },
  });
