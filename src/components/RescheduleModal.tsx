import React, { useState, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Task } from '../types/task';
import { formatTime } from '../utils/dateUtils';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task, newStartTime: string, newEndTime: string, note?: string) => void;
  timeFormat?: '12h' | '24h';
}

export const RescheduleModal: React.FC<Props> = ({
  visible,
  task,
  onClose,
  onConfirm,
  timeFormat = '12h',
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [note, setNote] = useState('');
  const [selectedShift, setSelectedShift] = useState<number | 'tonight' | 'tomorrow'>(1);
  const [manualOffsetMinutes, setManualOffsetMinutes] = useState<number>(0);

  if (!task) return null;

  const originalStart = new Date(task.startTime);
  const originalEnd = new Date(task.endTime);
  const durationMs = originalEnd.getTime() - originalStart.getTime();

  const computeNewTimes = (shift: number | 'tonight' | 'tomorrow', offsetMins: number = 0) => {
    let newStart: Date;
    const now = new Date();

    if (shift === 'tomorrow') {
      newStart = new Date(now);
      newStart.setDate(newStart.getDate() + 1);
      newStart.setHours(9, 0, 0, 0); // Tomorrow at 9:00 AM
    } else if (shift === 'tonight') {
      newStart = new Date(now);
      newStart.setHours(20, 0, 0, 0); // Tonight at 8:00 PM
      if (newStart.getTime() <= now.getTime()) {
        newStart.setDate(newStart.getDate() + 1);
      }
    } else {
      const base = originalStart > now ? originalStart : now;
      newStart = new Date(base.getTime() + shift * 60 * 60 * 1000);
    }

    if (offsetMins !== 0) {
      newStart = new Date(newStart.getTime() + offsetMins * 60 * 1000);
    }

    const newEnd = new Date(newStart.getTime() + durationMs);
    return {
      newStartIso: newStart.toISOString(),
      newEndIso: newEnd.toISOString(),
      newStart,
      newEnd,
    };
  };

  const preview = computeNewTimes(selectedShift, manualOffsetMinutes);

  const handleConfirm = () => {
    const { newStartIso, newEndIso } = computeNewTimes(selectedShift, manualOffsetMinutes);
    onConfirm(task, newStartIso, newEndIso, note.trim() || undefined);
    setNote('');
    setSelectedShift(1);
    setManualOffsetMinutes(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Reschedule Task</Text>
          <Text style={styles.taskTitle}>&ldquo;{task.title}&rdquo;</Text>

          <Text style={styles.sectionLabel}>Quick Shift Presets:</Text>
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={[styles.presetBtn, selectedShift === 1 && styles.presetBtnActive]}
              onPress={() => {
                setSelectedShift(1);
                setManualOffsetMinutes(0);
              }}
            >
              <Text style={[styles.presetText, selectedShift === 1 && styles.presetTextActive]}>
                +1h
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, selectedShift === 2 && styles.presetBtnActive]}
              onPress={() => {
                setSelectedShift(2);
                setManualOffsetMinutes(0);
              }}
            >
              <Text style={[styles.presetText, selectedShift === 2 && styles.presetTextActive]}>
                +2h
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, selectedShift === 'tonight' && styles.presetBtnActive]}
              onPress={() => {
                setSelectedShift('tonight');
                setManualOffsetMinutes(0);
              }}
            >
              <Text style={[styles.presetText, selectedShift === 'tonight' && styles.presetTextActive]}>
                Tonight (8 PM)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, selectedShift === 'tomorrow' && styles.presetBtnActive]}
              onPress={() => {
                setSelectedShift('tomorrow');
                setManualOffsetMinutes(0);
              }}
            >
              <Text style={[styles.presetText, selectedShift === 'tomorrow' && styles.presetTextActive]}>
                Tomorrow (9 AM)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fine Tune Minutes Adjuster */}
          <View style={styles.fineTuneRow}>
            <Text style={styles.fineTuneLabel}>Fine-tune:</Text>
            <TouchableOpacity
              style={styles.fineTuneBtn}
              onPress={() => setManualOffsetMinutes((prev) => prev - 15)}
            >
              <Text style={styles.fineTuneBtnText}>-15m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fineTuneBtn}
              onPress={() => setManualOffsetMinutes((prev) => prev + 15)}
            >
              <Text style={styles.fineTuneBtnText}>+15m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fineTuneBtn}
              onPress={() => setManualOffsetMinutes((prev) => prev + 30)}
            >
              <Text style={styles.fineTuneBtnText}>+30m</Text>
            </TouchableOpacity>
          </View>

          {/* Time Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>New Scheduled Window:</Text>
            <Text style={styles.previewValue}>
              {formatTime(preview.newStartIso, timeFormat)} – {formatTime(preview.newEndIso, timeFormat)}
            </Text>
          </View>

          {/* Optional Note */}
          <Text style={styles.sectionLabel}>Reason / Reflection Note (Optional):</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Urgent client call, took a break to recharge..."
            placeholderTextColor={theme.colors.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmBtnText}>Save Reschedule</Text>
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
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    dialog: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.xl,
      ...theme.shadows.modal,
    },
    dialogTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    taskTitle: {
      fontSize: theme.typography.fontSize.base,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.semibold,
      marginBottom: theme.spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
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
    presetText: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    presetTextActive: {
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    fineTuneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    fineTuneLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    fineTuneBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    fineTuneBtnText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.semibold,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    previewBox: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : theme.colors.primaryTint,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.base,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : theme.colors.borderSubtle,
    },
    previewLabel: {
      fontSize: 10,
      color: isDark ? '#94A3B8' : theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.heavy,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    previewValue: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0.5,
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
      marginBottom: theme.spacing.xl,
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
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
    confirmBtn: {
      flex: 2,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    confirmBtnText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
    },
  });
