import React, { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { DayProgressSummary } from '../types/task';
import { formatDate, isToday, addDays } from '../utils/dateUtils';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  selectedDate: Date;
  onDateChange: (newDate: Date) => void;
  onOpenCalendar?: () => void;
  summary: DayProgressSummary;
}

export const HeaderProgress: React.FC<Props> = ({
  selectedDate,
  onDateChange,
  onOpenCalendar,
  summary,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const percent = Math.round(summary.completionRate * 100);

  return (
    <View style={styles.container}>
      {/* Date Navigation Row */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => onDateChange(addDays(selectedDate, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateCenter}
          onPress={onOpenCalendar || (() => onDateChange(new Date()))}
          activeOpacity={0.7}
        >
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Text style={styles.dropdownChevron}>▾</Text>
          {isToday(selectedDate) && (
            <View style={styles.todayPill}>
              <Text style={styles.todayText}>Today</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => onDateChange(addDays(selectedDate, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Progress & Momentum Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>DAILY MOMENTUM</Text>
          <Text style={styles.progressPercent}>
            {summary.total > 0
              ? `${summary.completed}/${summary.total} Done • ${percent}%`
              : '0 planned'}
          </Text>
        </View>

        {/* Slim Momentum Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, percent))}%` },
            ]}
          />
        </View>

        {/* Airy Pill Stats (Clean single-line flow, only non-zero or crisp pills) */}
        <View style={styles.pillsRow}>
          <View style={[styles.miniPill, { backgroundColor: theme.colors.status.completedBg }]}>
            <Text style={[styles.miniPillText, { color: theme.colors.status.completed }]}>
              ✓ {summary.completed} Done
            </Text>
          </View>

          {summary.inProgress > 0 && (
            <View style={[styles.miniPill, { backgroundColor: theme.colors.status.inProgressBg }]}>
              <Text style={[styles.miniPillText, { color: theme.colors.status.inProgress }]}>
                ⚡ {summary.inProgress} Active
              </Text>
            </View>
          )}

          <View style={[styles.miniPill, { backgroundColor: theme.colors.surfaceSecondary }]}>
            <Text style={[styles.miniPillText, { color: theme.colors.textSecondary }]}>
              ⏳ {summary.upcoming} Queue
            </Text>
          </View>

          {summary.missed > 0 && (
            <View style={[styles.miniPill, { backgroundColor: theme.colors.status.missedBg }]}>
              <Text style={[styles.miniPillText, { color: theme.colors.status.missed }]}>
                ⚠️ {summary.missed} Overdue
              </Text>
            </View>
          )}

          {summary.skipped > 0 && (
            <View style={[styles.miniPill, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Text style={[styles.miniPillText, { color: theme.colors.textMuted }]}>
                ✕ {summary.skipped}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.base,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navButtonText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      marginTop: -2,
    },
    dateCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    },
    calendarIcon: {
      fontSize: 14,
      marginRight: 6,
    },
    dateText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    dropdownChevron: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    todayPill: {
      marginLeft: 6,
      backgroundColor: theme.colors.primaryTint,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
    },
    todayText: {
      fontSize: 9,
      color: theme.colors.primary,
      fontWeight: '800',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    progressSection: {
      marginTop: 2,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    progressLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.colors.textMuted,
      letterSpacing: 0.6,
    },
    progressPercent: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    progressBarTrack: {
      height: 5,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.full,
    },
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    miniPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniPillText: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
  });
