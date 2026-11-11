import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Task, TaskStatus } from '../types/task';
import { formatTime, formatDuration, formatDate } from '../utils/dateUtils';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  task: Task;
  onComplete: (task: Task) => void;
  onSkip: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onRequestDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onViewHistory: (task: Task) => void;
  timeFormat?: '12h' | '24h';
}

export const TaskCard: React.FC<Props> = ({
  task,
  onComplete,
  onSkip,
  onReschedule,
  onDelete,
  onRequestDelete,
  onEdit,
  onViewHistory,
  timeFormat = '12h',
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [isExpanded, setIsExpanded] = useState(false);

  const isTerminal = task.status === 'completed' || task.status === 'skipped';
  const isMissed = task.status === 'missed';
  const isInProgress = task.status === 'in_progress';

  const durationStr = formatDuration(task.startTime, task.endTime);
  const timeBoundary = `${formatTime(task.startTime, timeFormat)} – ${formatTime(task.endTime, timeFormat)} · ${durationStr}`;

  const handleDeletePress = () => {
    if (onRequestDelete) {
      onRequestDelete(task);
    } else {
      onDelete(task.id);
    }
  };

  const renderBadge = (status: TaskStatus) => {
    switch (status) {
      case 'in_progress':
        return (
          <View style={[styles.badge, styles.badgeActive]}>
            <View style={styles.pulseDot} />
            <Text style={[styles.badgeText, styles.badgeActiveText]}>Active</Text>
          </View>
        );
      case 'upcoming':
        return (
          <View style={[styles.badge, styles.badgeUpcoming]}>
            <Text style={[styles.badgeText, styles.badgeUpcomingText]}>Upcoming</Text>
          </View>
        );
      case 'missed':
        return (
          <View style={[styles.badge, styles.badgeMissed]}>
            <Text style={[styles.badgeText, styles.badgeMissedText]}>Overdue</Text>
          </View>
        );
      case 'completed':
        return (
          <View style={[styles.badge, styles.badgeCompleted]}>
            <Text style={[styles.badgeText, styles.badgeCompletedText]}>✓ Done</Text>
          </View>
        );
      case 'skipped':
        return (
          <View style={[styles.badge, styles.badgeSkipped]}>
            <Text style={[styles.badgeText, styles.badgeSkippedText]}>Skipped</Text>
          </View>
        );
    }
  };

  const getPriorityDotColor = () => {
    if (task.priority === 'high') return theme.colors.priority.high;
    if (task.priority === 'low') return theme.colors.priority.low;
    return theme.colors.priority.medium;
  };

  return (
    <View style={[styles.card, isInProgress && styles.cardActive, isMissed && styles.cardMissed]}>
      {/* Clean Top Header: Priority dot, Monospaced Time Boundary, Optional Goal Day, and Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.timeCluster}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityDotColor() }]} />
          <Text style={styles.monospacedTimeText}>{timeBoundary}</Text>
          {task.goalId && (
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>Day {task.goalDayNumber}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>{renderBadge(task.status)}</View>
      </View>

      {/* Title & Optional Compact Description */}
      <View style={styles.contentSection}>
        <Text style={[styles.title, isTerminal && styles.titleMuted]}>{task.title}</Text>
        {task.description ? (
          <Text style={styles.description} numberOfLines={isExpanded ? undefined : 1}>
            {task.description}
          </Text>
        ) : null}
      </View>

      {/* Subtle Single-Line Status Meta */}
      {isMissed && (
        <Text style={styles.missedHintText}>
          🤝 Missed schedule · Done Late or Reschedule anytime
        </Text>
      )}
      {task.status === 'completed' && task.completedAt && (
        <Text style={styles.completedHintText}>
          ✓ Completed at {formatTime(task.completedAt, timeFormat)}
        </Text>
      )}

      {/* Expanded Details Section */}
      {isExpanded && (
        <View style={styles.detailsExpansion}>
          <Text style={styles.detailRowText}>📅 {formatDate(new Date(task.startTime))} · Priority: {task.priority.toUpperCase()}</Text>
          {task.updatedAt && (
            <Text style={styles.detailRowText}>✏️ Updated {formatTime(task.updatedAt, timeFormat)}</Text>
          )}
          {task.goalId && (
            <Text style={styles.detailRowText}>🎯 Goal Milestone: Day {task.goalDayNumber}</Text>
          )}
        </View>
      )}

      {/* Primary Action Row */}
      <View style={styles.primaryActionRow}>
        {!isTerminal ? (
          <>
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.completeBtn]}
              onPress={() => onComplete(task)}
              activeOpacity={0.8}
            >
              <Text style={styles.completeBtnText} numberOfLines={1}>
                {isMissed ? '✓ Done Late' : '✓ Done'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.rescheduleBtn]}
              onPress={() => onReschedule(task)}
              activeOpacity={0.8}
            >
              <Text style={styles.rescheduleBtnText} numberOfLines={1}>
                ↻ Reschedule
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.skipBtn]}
              onPress={() => onSkip(task)}
              activeOpacity={0.8}
            >
              <Text style={styles.skipBtnText} numberOfLines={1}>
                ✕ Skip
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryActionBtn, styles.rescheduleBtn, { flex: 1 }]}
            onPress={() => onReschedule(task)}
            activeOpacity={0.8}
          >
            <Text style={styles.rescheduleBtnText} numberOfLines={1}>
              ↻ Re-run / Reschedule
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Clean Ghost Utility Footer */}
      <View style={styles.utilityFooter}>
        <TouchableOpacity
          onPress={() => setIsExpanded(!isExpanded)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.utilityText}>
            {isExpanded ? '▴ Less' : '▾ More'}
          </Text>
        </TouchableOpacity>

        <View style={styles.utilityActionsRight}>
          {onEdit && !isTerminal && (
            <TouchableOpacity
              onPress={() => onEdit(task)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.utilityText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onViewHistory(task)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.utilityText}>📜 Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.utilityDeleteText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 13,
      marginHorizontal: theme.spacing.base,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      ...theme.shadows.card,
    },
    cardActive: {
      borderColor: theme.colors.status.inProgressBorder,
      borderLeftWidth: 3.5,
      borderLeftColor: theme.colors.status.inProgress,
      backgroundColor: isDark ? '#161F30' : theme.colors.status.inProgressBg,
    },
    cardMissed: {
      borderColor: theme.colors.status.missedBorder,
      borderLeftWidth: 3.5,
      borderLeftColor: theme.colors.status.missed,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.04)' : theme.colors.status.missedBg,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    timeCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    priorityDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    monospacedTimeText: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#CBD5E1' : theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    goalBadge: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: theme.radius.xs,
    },
    goalBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: isDark ? '#C084FC' : '#7E22CE',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
    },
    badgeActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
    },
    badgeUpcoming: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
    },
    badgeMissed: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    badgeCompleted: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    badgeSkipped: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    },
    pulseDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#38BDF8',
      marginRight: 4,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '700',
    },
    badgeActiveText: {
      color: '#38BDF8',
    },
    badgeUpcomingText: {
      color: theme.colors.textSecondary,
    },
    badgeMissedText: {
      color: '#F59E0B',
    },
    badgeCompletedText: {
      color: '#10B981',
    },
    badgeSkippedText: {
      color: theme.colors.textMuted,
    },
    contentSection: {
      marginBottom: 8,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      lineHeight: 20,
    },
    titleMuted: {
      color: theme.colors.textMuted,
      textDecorationLine: 'line-through',
    },
    description: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    missedHintText: {
      fontSize: 11,
      color: '#F59E0B',
      marginBottom: 8,
      fontWeight: '500',
    },
    completedHintText: {
      fontSize: 11,
      color: '#10B981',
      marginBottom: 8,
      fontWeight: '500',
    },
    detailsExpansion: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.sm,
      padding: 8,
      marginBottom: 8,
      gap: 3,
    },
    detailRowText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    primaryActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    primaryActionBtn: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeBtn: {
      backgroundColor: '#10B981',
      flex: 1.3,
    },
    completeBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    rescheduleBtn: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      flex: 1.3,
    },
    rescheduleBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    skipBtn: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      flex: 0.9,
    },
    skipBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    utilityFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 7,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.borderSubtle,
    },
    utilityActionsRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    utilityText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    utilityDeleteText: {
      fontSize: 11,
    },
  });
