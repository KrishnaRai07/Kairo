import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Platform,
} from 'react-native';
import { Task, TaskHistoryEvent } from '../types/task';
import { formatTime, formatDate } from '../utils/dateUtils';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  visible: boolean;
  task: Task | null;
  history: TaskHistoryEvent[];
  onClose: () => void;
  timeFormat?: '12h' | '24h';
}

export const HistoryModal: React.FC<Props> = ({
  visible,
  task,
  history,
  onClose,
  timeFormat = '12h',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  if (!task) return null;

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'created':
        return { label: 'Created', color: theme.colors.primaryLight, bg: theme.colors.primaryTint };
      case 'started':
        return { label: 'Started', color: theme.colors.status.inProgress, bg: theme.colors.status.inProgressBg };
      case 'completed':
        return { label: 'Completed', color: theme.colors.status.completed, bg: theme.colors.status.completedBg };
      case 'completed_late':
        return { label: 'Completed Late', color: theme.colors.status.completedLate, bg: theme.colors.status.completedLateBg };
      case 'missed':
        return { label: 'Became Missed', color: theme.colors.status.missed, bg: theme.colors.status.missedBg };
      case 'skipped':
        return { label: 'Skipped', color: theme.colors.status.skipped, bg: theme.colors.status.skippedBg };
      case 'rescheduled':
        return { label: 'Rescheduled', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' };
      case 'edited':
        return { label: 'Edited', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
      default:
        return { label: type, color: theme.colors.textSecondary, bg: theme.colors.surfaceSecondary };
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Task Accountability Log</Text>
              <Text style={styles.subtitle} numberOfLines={1}>&ldquo;{task.title}&rdquo;</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Timeline Events */}
          <ScrollView style={styles.scrollArea}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>No historical events logged yet.</Text>
            ) : (
              history.map((ev, index) => {
                const badge = getEventBadge(ev.eventType);
                const evDate = new Date(ev.timestamp);
                const timeString = `${formatDate(evDate)} at ${formatTime(ev.timestamp, timeFormat)}`;

                return (
                  <View key={ev.id || index} style={styles.timelineItem}>
                    {/* Left indicator line */}
                    <View style={styles.timelineIndicator}>
                      <View style={[styles.timelineDot, { backgroundColor: badge.color }]} />
                      {index < history.length - 1 && <View style={styles.timelineLine} />}
                    </View>

                    {/* Content */}
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.color }]}>
                            {badge.label}
                          </Text>
                        </View>
                        <Text style={styles.eventTime}>{timeString}</Text>
                      </View>

                      {(ev.eventType === 'rescheduled' || ev.eventType === 'edited') &&
                        ev.oldStartTime &&
                        ev.newStartTime && (
                          <View style={styles.rescheduleDetails}>
                            <Text style={styles.scheduleChangeText}>
                              From: {formatTime(ev.oldStartTime, timeFormat)} – {formatTime(ev.oldEndTime || '', timeFormat)}
                            </Text>
                            <Text style={styles.scheduleChangeText}>
                              To: {formatTime(ev.newStartTime, timeFormat)} – {formatTime(ev.newEndTime || '', timeFormat)}
                            </Text>
                          </View>
                        )}

                      {ev.note ? <Text style={styles.noteText}>{ev.note}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    paddingBottom: theme.spacing.md,
  },
  headerText: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 20,
    color: theme.colors.textMuted,
    padding: 4,
  },
  scrollArea: {
    paddingVertical: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.base,
  },
  timelineIndicator: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
  },
  eventTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rescheduleDetails: {
    marginTop: 6,
    padding: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
  },
  scheduleChangeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  noteText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textPrimary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  doneBtn: {
    minHeight: theme.layout.minTouchTarget,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
});
