import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Task,
  WeeklyTrend,
  MonthlyTrend,
  GoalProgress,
  ResilienceMetrics,
  FocusTimeDistribution,
  HeatmapDay,
} from '../types/task';
import { TaskRepository } from '../database/taskRepository';
import {
  computeWeeklyTrend,
  computeMonthlyMetrics,
  computeDayMetrics,
  computeResilienceMetrics,
  computeFocusTimeDistribution,
  computeActivityHeatmap,
} from '../services/analyticsService';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';
import { formatDate } from '../utils/dateUtils';

interface Props {
  tasks: Task[];
  selectedDate: Date;
}

type InsightsTab = 'recovery' | 'trends';

export const InsightsView: React.FC<Props> = ({ tasks, selectedDate }) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InsightsTab>('recovery');
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend | null>(null);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [resilience, setResilience] = useState<ResilienceMetrics | null>(null);
  const [focusDist, setFocusDist] = useState<FocusTimeDistribution | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [chartMode, setChartMode] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    let isMounted = true;

    async function fetchAnalytics() {
      try {
        const fetchedAllTasks = await TaskRepository.getAllTasks();

        const past60Days = new Date(selectedDate);
        past60Days.setDate(past60Days.getDate() - 60);
        const future30Days = new Date(selectedDate);
        future30Days.setDate(future30Days.getDate() + 30);

        const events = await TaskRepository.getHistoryEventsForDateRange(
          past60Days.toISOString(),
          future30Days.toISOString()
        );

        const allGoals = await TaskRepository.getAllGoals();

        const weekly = computeWeeklyTrend(fetchedAllTasks, events, selectedDate);
        const monthly = computeMonthlyMetrics(fetchedAllTasks, events, selectedDate);
        const res = computeResilienceMetrics(fetchedAllTasks, events);
        const dist = computeFocusTimeDistribution(fetchedAllTasks);
        const heat = computeActivityHeatmap(fetchedAllTasks, selectedDate, 28);

        if (isMounted) {
          setWeeklyTrend(weekly);
          setMonthlyTrend(monthly);
          setGoals(allGoals);
          setResilience(res);
          setFocusDist(dist);
          setHeatmap(heat);
        }
      } catch (error) {
        console.warn('Failed to load analytics:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAnalytics();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, tasks]);

  const dayMetrics = computeDayMetrics(tasks, selectedDate);
  const dayRatePct = Math.round(dayMetrics.completionRate * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Intentional reflection & execution momentum</Text>
      </View>

      {/* Clean 2-Way Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'recovery' && styles.tabButtonActive]}
          onPress={() => setActiveTab('recovery')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'recovery' && styles.tabButtonTextActive]}>
            Daily & Resilience
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'trends' && styles.tabButtonActive]}
          onPress={() => setActiveTab('trends')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'trends' && styles.tabButtonTextActive]}>
            Trends & Rhythm
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Calculating patterns...</Text>
        </View>
      ) : activeTab === 'recovery' ? (
        <>
          {/* 1. Daily Reflection Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{formatDate(selectedDate)}</Text>
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>{dayRatePct}% Done</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: theme.colors.status.completed }]}>
                  {dayMetrics.completed}
                </Text>
                <Text style={styles.metricLabel}>Done</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: theme.colors.status.completedLate }]}>
                  {dayMetrics.completedLate}
                </Text>
                <Text style={styles.metricLabel}>Late</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: theme.colors.status.missed }]}>
                  {dayMetrics.missed}
                </Text>
                <Text style={styles.metricLabel}>Missed</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: theme.colors.status.skipped }]}>
                  {dayMetrics.skipped}
                </Text>
                <Text style={styles.metricLabel}>Skipped</Text>
              </View>
            </View>

            <Text style={styles.footerNote}>
              Scheduled: {Math.round((dayMetrics.scheduledMinutes / 60) * 10) / 10}h
            </Text>
          </View>

          {/* 2. Resilience Metric Card */}
          {resilience && (
            <View style={[styles.sectionCard, styles.resilienceCard]}>
              <View style={styles.sectionHeader}>
                <View style={styles.rowAlign}>
                  <Text style={styles.resilienceIcon}>🛡️</Text>
                  <Text style={styles.sectionTitle}>Resilience Score</Text>
                </View>
                <View style={styles.resilienceScoreBadge}>
                  <Text style={styles.resilienceScoreText}>{resilience.resilienceScore}% Recovery</Text>
                </View>
              </View>

              <Text style={styles.resilienceNarrative}>
                Recovered <Text style={styles.boldText}>{resilience.recoveredCount}</Text> of{' '}
                <Text style={styles.boldText}>{resilience.totalDisruptions}</Text> disrupted tasks
                without giving up. Consistency is persistence, not perfection.
              </Text>

              <View style={styles.resilienceBarTrack}>
                <View
                  style={[
                    styles.resilienceBarFill,
                    { width: `${Math.min(100, Math.max(5, resilience.resilienceScore))}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* 3. Goals Snapshot */}
          {goals.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🎯 Target Goals ({goals.length})</Text>
              {goals.map((g) => {
                const pct = Math.round(g.completionRate * 100);
                return (
                  <View key={g.id} style={styles.goalMiniItem}>
                    <View style={styles.goalMiniHeader}>
                      <Text style={styles.goalMiniTitle} numberOfLines={1}>{g.title}</Text>
                      <Text style={styles.goalMiniMilestone}>Day {g.currentDayNumber}/{g.totalDays}</Text>
                    </View>
                    <View style={styles.goalTrack}>
                      <View style={[styles.goalFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <>
          {/* 1. 28-Day Consistency Matrix Heatmap */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>28-Day Consistency</Text>
              <Text style={styles.heatmapCountText}>
                {heatmap.filter((d) => d.completedCount > 0).length} active days
              </Text>
            </View>

            <View style={styles.heatmapGrid}>
              {heatmap.map((cell, idx) => {
                let cellStyle = styles.heatCell0;
                if (cell.level === 1) cellStyle = styles.heatCell1;
                else if (cell.level === 2) cellStyle = styles.heatCell2;
                else if (cell.level === 3) cellStyle = styles.heatCell3;

                return (
                  <View key={`${cell.date}_${idx}`} style={styles.heatCellWrapper}>
                    <View style={[styles.heatCell, cellStyle]} />
                  </View>
                );
              })}
            </View>

            <View style={styles.heatmapLegend}>
              <Text style={styles.legendText}>Less</Text>
              <View style={[styles.miniDot, styles.heatCell0]} />
              <View style={[styles.miniDot, styles.heatCell1]} />
              <View style={[styles.miniDot, styles.heatCell2]} />
              <View style={[styles.miniDot, styles.heatCell3]} />
              <Text style={styles.legendText}>More Focus</Text>
            </View>
          </View>

          {/* 2. Peak Focus Windows */}
          {focusDist && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>⏰ Focus Windows</Text>
                <Text style={styles.peakBadge}>{focusDist.peakWindow}</Text>
              </View>

              <View style={styles.distributionRow}>
                <View style={styles.distBlock}>
                  <Text style={styles.distValue}>{focusDist.morningHours}h</Text>
                  <Text style={styles.distLabel}>Morning</Text>
                </View>
                <View style={styles.distBlock}>
                  <Text style={styles.distValue}>{focusDist.afternoonHours}h</Text>
                  <Text style={styles.distLabel}>Afternoon</Text>
                </View>
                <View style={styles.distBlock}>
                  <Text style={styles.distValue}>{focusDist.eveningHours}h</Text>
                  <Text style={styles.distLabel}>Evening</Text>
                </View>
              </View>
            </View>
          )}

          {/* 3. Trends (7-Day vs 30-Day) */}
          <View style={styles.chartToggleRow}>
            <TouchableOpacity
              style={[styles.chartToggleBtn, chartMode === 'weekly' && styles.chartToggleBtnActive]}
              onPress={() => setChartMode('weekly')}
            >
              <Text style={[styles.chartToggleText, chartMode === 'weekly' && styles.chartToggleTextActive]}>
                7-Day Trend
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartToggleBtn, chartMode === 'monthly' && styles.chartToggleBtnActive]}
              onPress={() => setChartMode('monthly')}
            >
              <Text style={[styles.chartToggleText, chartMode === 'monthly' && styles.chartToggleTextActive]}>
                30-Day Total
              </Text>
            </TouchableOpacity>
          </View>

          {chartMode === 'weekly' && weeklyTrend ? (
            <View style={styles.sectionCard}>
              <View style={styles.barChartContainer}>
                {weeklyTrend.days.map((d, index) => {
                  const completionPct = Math.round(d.completionRate * 100);
                  const barHeight = d.totalPlanned > 0 ? Math.max(12, completionPct) : 4;
                  const isDayEmpty = d.totalPlanned === 0;

                  return (
                    <View key={d.date || index} style={styles.barColumn}>
                      <Text style={styles.barPctText}>{isDayEmpty ? '—' : `${completionPct}%`}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${barHeight}%`,
                              backgroundColor: isDayEmpty
                                ? isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : theme.colors.surfaceMuted
                                : completionPct >= 80
                                ? theme.colors.status.completed
                                : completionPct >= 50
                                ? theme.colors.primary
                                : theme.colors.status.missed,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barDayLabel}>{d.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.highlightsContainer}>
                <View style={styles.highlightCard}>
                  <Text style={styles.highlightValue}>
                    {Math.round(weeklyTrend.averageCompletionRate * 100)}%
                  </Text>
                  <Text style={styles.highlightLabel}>Weekly Rate</Text>
                </View>
                <View style={styles.highlightCard}>
                  <Text style={styles.highlightValue}>{weeklyTrend.lateRecoveryCount}</Text>
                  <Text style={styles.highlightLabel}>Recoveries</Text>
                </View>
                <View style={styles.highlightCard}>
                  <Text style={styles.highlightValue}>{weeklyTrend.rescheduleCount}</Text>
                  <Text style={styles.highlightLabel}>Rescheduled</Text>
                </View>
              </View>
            </View>
          ) : monthlyTrend ? (
            <View style={styles.sectionCard}>
              <View style={styles.monthlyGrid}>
                <View style={styles.monthlyItem}>
                  <Text style={styles.monthlyNum}>{monthlyTrend.totalPlanned}</Text>
                  <Text style={styles.monthlySub}>Planned</Text>
                </View>
                <View style={styles.monthlyItem}>
                  <Text style={[styles.monthlyNum, { color: theme.colors.status.completed }]}>
                    {monthlyTrend.totalCompleted}
                  </Text>
                  <Text style={styles.monthlySub}>Completed</Text>
                </View>
                <View style={styles.monthlyItem}>
                  <Text style={styles.monthlyNum}>{monthlyTrend.totalScheduledHours}h</Text>
                  <Text style={styles.monthlySub}>Focus Time</Text>
                </View>
                <View style={styles.monthlyItem}>
                  <Text style={[styles.monthlyNum, { color: theme.colors.primary }]}>
                    {Math.round(monthlyTrend.overallCompletionRate * 100)}%
                  </Text>
                  <Text style={styles.monthlySub}>Rate</Text>
                </View>
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.base,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 3,
      marginBottom: 14,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: theme.radius.sm,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    tabButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    tabButtonTextActive: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      ...theme.shadows.card,
    },
    resilienceCard: {
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.35)',
      backgroundColor: isDark ? '#0D1524' : '#F0F9FF',
    },
    rowAlign: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    resilienceIcon: {
      fontSize: 15,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    rateBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    rateBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#38BDF8',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    resilienceScoreBadge: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    resilienceScoreText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#38BDF8',
    },
    resilienceNarrative: {
      fontSize: 12,
      color: isDark ? '#CBD5E1' : '#334155',
      lineHeight: 17,
      marginBottom: 8,
    },
    boldText: {
      fontWeight: '700',
      color: '#38BDF8',
    },
    resilienceBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
    },
    resilienceBarFill: {
      height: '100%',
      backgroundColor: '#38BDF8',
      borderRadius: 3,
    },
    metricsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 8,
    },
    metricItem: {
      alignItems: 'center',
    },
    metricNumber: {
      fontSize: 18,
      fontWeight: '800',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    metricLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    footerNote: {
      fontSize: 11,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
    goalMiniItem: {
      marginTop: 8,
    },
    goalMiniHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    goalMiniTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flex: 1,
    },
    goalMiniMilestone: {
      fontSize: 10,
      fontWeight: '700',
      color: '#A855F7',
    },
    goalTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
    },
    goalFill: {
      height: '100%',
      backgroundColor: '#A855F7',
    },
    heatmapCountText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    heatmapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    heatCellWrapper: {
      width: '12%',
      alignItems: 'center',
      marginVertical: 2,
    },
    heatCell: {
      width: 20,
      height: 20,
      borderRadius: 5,
    },
    heatCell0: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    },
    heatCell1: {
      backgroundColor: 'rgba(56, 189, 248, 0.35)',
    },
    heatCell2: {
      backgroundColor: '#38BDF8',
    },
    heatCell3: {
      backgroundColor: '#A855F7',
    },
    heatmapLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 5,
      marginTop: 8,
    },
    miniDot: {
      width: 8,
      height: 8,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 9,
      color: theme.colors.textMuted,
    },
    peakBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: '#38BDF8',
    },
    distributionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    distBlock: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      padding: 8,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    distValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    distLabel: {
      fontSize: 9,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    chartToggleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    chartToggleBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
    },
    chartToggleBtnActive: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    chartToggleText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    chartToggleTextActive: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    barChartContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 140,
      paddingTop: 8,
      paddingBottom: 4,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
    },
    barPctText: {
      fontSize: 9,
      color: theme.colors.textMuted,
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    barTrack: {
      width: 12,
      height: 85,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.surfaceSecondary,
      borderRadius: 6,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: 6,
    },
    barDayLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginTop: 4,
    },
    highlightsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: 8,
    },
    highlightCard: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 8,
      alignItems: 'center',
    },
    highlightValue: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    highlightLabel: {
      fontSize: 9,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    monthlyGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    monthlyItem: {
      width: '48%',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 10,
      alignItems: 'center',
    },
    monthlyNum: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    monthlySub: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    loadingContainer: {
      padding: 30,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 8,
      color: theme.colors.textMuted,
      fontSize: 12,
    },
  });
