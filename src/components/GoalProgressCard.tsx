import React, { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { GoalProgress } from '../types/task';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  goals: GoalProgress[];
  onOpenCreateGoal: () => void;
  onDeleteGoal: (goalId: string) => void;
}

export const GoalProgressCard: React.FC<Props> = ({
  goals,
  onOpenCreateGoal,
  onDeleteGoal,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const handleDeletePress = (goal: GoalProgress) => {
    Alert.alert(
      'Delete Goal?',
      `Delete "${goal.title}" and its ${goal.totalDays} linked daily tasks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteGoal(goal.id),
        },
      ]
    );
  };

  if (goals.length === 0) {
    return (
      <TouchableOpacity
        style={styles.emptyStrip}
        onPress={onOpenCreateGoal}
        activeOpacity={0.8}
      >
        <View style={styles.emptyLeftRow}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyStripTitle}>Track a 30-Day Target Goal</Text>
        </View>
        <View style={styles.emptyAddPill}>
          <Text style={styles.emptyAddPillText}>+ Set Goal</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🎯 GOALS ({goals.length})</Text>
        <TouchableOpacity
          style={styles.addMiniBtn}
          onPress={onOpenCreateGoal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.addMiniBtnText}>+ Goal</Text>
        </TouchableOpacity>
      </View>

      {goals.map((g) => {
        const percent = Math.round(g.completionRate * 100);
        return (
          <View key={g.id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.titleWrapper}>
                <Text style={styles.goalTitle} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text style={styles.goalTimeSubtitle}>
                  Daily {g.preferredTime} · {g.durationMinutes}m · {g.completedDays}/{g.totalDays} done
                </Text>
              </View>

              <View style={styles.headerRight}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>
                    Day {g.currentDayNumber}/{g.totalDays}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeletePress(g)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.max(0, percent))}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercentText}>{percent}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    emptyStrip: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.08)' : '#FAF5FF',
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: theme.spacing.base,
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#E9D5FF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyLeftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emptyIcon: {
      fontSize: 15,
    },
    emptyStripTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    emptyAddPill: {
      backgroundColor: '#9333EA',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: theme.radius.sm,
    },
    emptyAddPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    container: {
      marginHorizontal: theme.spacing.base,
      marginTop: 10,
      marginBottom: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? '#C084FC' : '#7E22CE',
      letterSpacing: 0.6,
    },
    addMiniBtn: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: theme.radius.xs,
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
    },
    addMiniBtnText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#A855F7',
    },
    goalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#E9D5FF',
      ...theme.shadows.card,
    },
    goalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    titleWrapper: {
      flex: 1,
      marginRight: 8,
    },
    goalTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    goalTimeSubtitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dayBadge: {
      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#F3E8FF',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
    },
    dayBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? '#C084FC' : '#7E22CE',
    },
    deleteBtn: {
      padding: 2,
    },
    deleteBtnText: {
      fontSize: 11,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBarTrack: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: '#9333EA',
    },
    progressPercentText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#A855F7',
      minWidth: 28,
      textAlign: 'right',
    },
  });
