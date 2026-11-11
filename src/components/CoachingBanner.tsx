import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DayProgressSummary } from '../types/task';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  summary: DayProgressSummary;
}

/**
 * Contextual Coaching Banner:
 * Only renders when there is an actionable state (all tasks finished, or overdue tasks needing guilt-free reset)
 * to avoid crowding the daily flow with persistent boilerplate text.
 */
export const CoachingBanner: React.FC<Props> = ({ summary }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  if (summary.completed === summary.total && summary.total > 0) {
    return (
      <View style={[styles.pillBanner, styles.successBg]}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={[styles.message, styles.successText]}>
          All {summary.total} planned tasks complete today. Well done!
        </Text>
      </View>
    );
  }

  if (summary.missed > 0) {
    return (
      <View style={[styles.pillBanner, styles.warningBg]}>
        <Text style={styles.icon}>🤝</Text>
        <Text style={[styles.message, styles.warningText]}>
          {summary.missed} task{summary.missed > 1 ? 's' : ''} overdue — tap Done Late or Reschedule without guilt.
        </Text>
      </View>
    );
  }

  return null;
};

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    pillBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: theme.spacing.base,
      marginTop: 10,
      marginBottom: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    icon: {
      fontSize: 15,
      marginRight: 8,
    },
    message: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    warningBg: {
      backgroundColor: theme.colors.status.missedBg,
      borderColor: theme.colors.status.missedBorder,
    },
    warningText: {
      color: theme.colors.status.missed,
    },
    successBg: {
      backgroundColor: theme.colors.status.completedBg,
      borderColor: theme.colors.status.completedBorder,
    },
    successText: {
      color: theme.colors.status.completed,
    },
  });
