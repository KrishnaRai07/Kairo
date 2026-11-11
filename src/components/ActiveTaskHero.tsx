import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Task } from '../types/task';
import { formatTime, formatDuration } from '../utils/dateUtils';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  activeTask: Task | null;
  onComplete: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onSkip: (task: Task) => void;
  timeFormat?: '12h' | '24h';
}

export const ActiveTaskHero: React.FC<Props> = ({
  activeTask,
  onComplete,
  onReschedule,
  onSkip,
  timeFormat = '12h',
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [percentProgress, setPercentProgress] = useState(0);
  const [minutesRemaining, setMinutesRemaining] = useState(0);

  useEffect(() => {
    if (!activeTask) return;

    const calculateProgress = () => {
      const now = Date.now();
      const start = new Date(activeTask.startTime).getTime();
      const end = new Date(activeTask.endTime).getTime();
      const total = end - start;

      if (total <= 0) {
        setPercentProgress(100);
        setMinutesRemaining(0);
        return;
      }

      const elapsed = Math.max(0, now - start);
      const remaining = Math.max(0, Math.round((end - now) / (1000 * 60)));
      const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

      setPercentProgress(pct);
      setMinutesRemaining(remaining);
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 5000);
    return () => clearInterval(interval);
  }, [activeTask]);

  if (!activeTask) {
    return null;
  }

  const durationStr = formatDuration(activeTask.startTime, activeTask.endTime);
  const timeBoundary = `${formatTime(activeTask.startTime, timeFormat)} – ${formatTime(activeTask.endTime, timeFormat)} (${durationStr})`;

  return (
    <View style={styles.heroSpotlight}>
      {/* Top Header: Breathing Pulse Pill & Live Countdown */}
      <View style={styles.topHeaderRow}>
        <View style={styles.pulsePill}>
          <View style={styles.pulseOuterRing}>
            <View style={styles.pulseInnerCore} />
          </View>
          <Text style={styles.pulseLabel}>FOCUSING NOW</Text>
        </View>

        <View style={styles.countdownPill}>
          <Text style={styles.countdownNumber}>
            {minutesRemaining > 0 ? `${minutesRemaining}m left` : 'Ending now'}
          </Text>
        </View>
      </View>

      {/* Primary Task Title */}
      <Text style={styles.taskTitle}>{activeTask.title}</Text>
      {activeTask.description ? (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {activeTask.description}
        </Text>
      ) : null}

      {/* Monospaced Time Boundary Strip */}
      <View style={styles.boundaryStrip}>
        <Text style={styles.boundaryText}>{timeBoundary}</Text>
      </View>

      {/* Kinetic Segmented Progress Line */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentProgress}%` }]} />
      </View>

      {/* Fast 1-Tap Execution Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.completeHeroBtn}
          onPress={() => onComplete(activeTask)}
          activeOpacity={0.85}
        >
          <Text style={styles.completeHeroText}>✓ Mark as Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.adjustHeroBtn}
          onPress={() => onReschedule(activeTask)}
          activeOpacity={0.8}
        >
          <Text style={styles.adjustHeroText}>Reschedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipHeroBtn}
          onPress={() => onSkip(activeTask)}
          activeOpacity={0.8}
        >
          <Text style={styles.skipHeroText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    heroSpotlight: {
      backgroundColor: isDark ? '#0F172A' : theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      marginHorizontal: theme.spacing.base,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.base,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : theme.colors.primary,
      shadowColor: isDark ? '#38BDF8' : theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.15,
      shadowRadius: 18,
      elevation: 8,
    },
    topHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    pulsePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : theme.colors.primaryTint,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : theme.colors.primaryLight,
    },
    pulseOuterRing: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.4)' : theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    pulseInnerCore: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? '#38BDF8' : theme.colors.primary,
    },
    pulseLabel: {
      fontSize: 10,
      fontWeight: theme.typography.fontWeight.heavy,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      letterSpacing: 0.9,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    countdownPill: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : theme.colors.primaryTint,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : theme.colors.borderSubtle,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
    },
    countdownNumber: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      color: isDark ? '#38BDF8' : theme.colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    taskTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.heavy,
      color: theme.colors.textPrimary,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    taskDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.lineHeight.normal,
      marginBottom: theme.spacing.md,
    },
    boundaryStrip: {
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : theme.colors.surfaceSecondary,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    boundaryText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: isDark ? '#E2E8F0' : theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0.6,
    },
    progressTrack: {
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.surfaceSecondary,
      borderRadius: theme.radius.full,
      overflow: 'hidden',
      marginBottom: theme.spacing.lg,
    },
    progressFill: {
      height: '100%',
      backgroundColor: isDark ? '#38BDF8' : theme.colors.primary,
      borderRadius: theme.radius.full,
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    completeHeroBtn: {
      flex: 2,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    completeHeroText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    adjustHeroBtn: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustHeroText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    skipHeroBtn: {
      paddingHorizontal: 12,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipHeroText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textMuted,
    },
  });
