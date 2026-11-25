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
  TaskHistoryEvent,
  WeeklyTrend,
  MonthlyTrend,
  GoalProgress,
  ResilienceMetrics,
  FocusTimeDistribution,
  HeatmapDay,
  FlowScoreMetrics,
} from '../types/task';
import { TaskRepository } from '../database/taskRepository';
import {
  computeWeeklyTrend,
  computeMonthlyMetrics,
  computeDayMetrics,
  computeResilienceMetrics,
  computeFocusTimeDistribution,
  computeActivityHeatmap,
  computeFlowScoreAndMastery,
} from '../services/analyticsService';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';
import { formatDate } from '../utils/dateUtils';
import { FlowTrendsModal } from './FlowTrendsModal';

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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [historyEvents, setHistoryEvents] = useState<TaskHistoryEvent[]>([]);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend | null>(null);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [resilience, setResilience] = useState<ResilienceMetrics | null>(null);
  const [focusDist, setFocusDist] = useState<FocusTimeDistribution | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [flowScore, setFlowScore] = useState<FlowScoreMetrics | null>(null);
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
        const flow = computeFlowScoreAndMastery(fetchedAllTasks, events, selectedDate);

        if (isMounted) {
          setAllTasks(fetchedAllTasks);
          setHistoryEvents(events);
          setWeeklyTrend(weekly);
          setMonthlyTrend(monthly);
          setGoals(allGoals);
          setResilience(res);
          setFocusDist(dist);
          setHeatmap(heat);
          setFlowScore(flow);
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

  const activeDaysCount = heatmap.filter((d) => d.completedCount > 0).length;
  const consistencyPct = Math.round((activeDaysCount / 28) * 100);
  let currentStreak = 0;
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].completedCount > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Intentional reflection & execution momentum</Text>
      </View>

      {/* 0. Flow Mastery & Overall Score Spotlight Hero (Clickable to view Trends) */}
      {flowScore && (
        <TouchableOpacity
          style={styles.flowHeroCard}
          onPress={() => setShowTrendsModal(true)}
          activeOpacity={0.88}
        >
          <View style={styles.flowHeroHeader}>
            <View style={styles.flowHeroHeaderLeft}>
              <View style={styles.levelBadgeRow}>
                <Text style={styles.levelBadgeIcon}>{flowScore.masteryLevel.badge}</Text>
                <Text style={styles.levelBadgeText}>
                  LEVEL {flowScore.masteryLevel.level} · {flowScore.masteryLevel.title.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.flowStatusTitle}>{flowScore.statusLabel}</Text>
            </View>

            {/* Glowing Big Score Display */}
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{flowScore.overallScore}</Text>
              <Text style={styles.scoreUnit}>FLOW</Text>
            </View>
          </View>

          {/* Motivational Psychological Safety Coaching */}
          <Text style={styles.flowMotivationalText}>
            {flowScore.motivationalMessage}
          </Text>

          {/* Level Up Progress Meter (Days + Consistency Gate) */}
          <View style={styles.levelProgressContainer}>
            <View style={styles.levelProgressHeader}>
              <Text style={styles.levelProgressLabel}>
                {flowScore.masteryLevel.qualifiedDays} / {flowScore.masteryLevel.targetDays} Days at {flowScore.masteryLevel.minScoreThreshold}+ Flow
              </Text>
              <Text style={styles.levelNextLabel}>
                {flowScore.masteryLevel.daysRemainingForNext && flowScore.masteryLevel.daysRemainingForNext > 0
                  ? `${flowScore.masteryLevel.daysRemainingForNext}d to Level Up`
                  : 'Mastery Active'}
              </Text>
            </View>
            <View style={styles.levelProgressTrack}>
              <View
                style={[
                  styles.levelProgressFill,
                  { width: `${flowScore.masteryLevel.progressPercent}%` },
                ]}
              />
            </View>
          </View>

          {/* 4-Pillar Score Breakdown Pills */}
          <View style={styles.flowPillarsRow}>
            <View style={styles.pillarItem}>
              <Text style={styles.pillarValue}>{flowScore.breakdown.executionScore}%</Text>
              <Text style={styles.pillarLabel}>Execution</Text>
            </View>
            <View style={styles.pillarItem}>
              <Text style={styles.pillarValue}>{flowScore.breakdown.resilienceScore}%</Text>
              <Text style={styles.pillarLabel}>Resilience</Text>
            </View>
            <View style={styles.pillarItem}>
              <Text style={styles.pillarValue}>{flowScore.breakdown.consistencyScore}%</Text>
              <Text style={styles.pillarLabel}>Consistency</Text>
            </View>
            <View style={styles.pillarItem}>
              <Text style={styles.pillarValue}>{flowScore.breakdown.pacingScore}%</Text>
              <Text style={styles.pillarLabel}>Pacing</Text>
            </View>
          </View>

          {/* Clickable Callout to View Trends */}
          <View style={styles.flowTrendCtaRow}>
            <Text style={styles.flowTrendCtaText}>📈 View Monthly & Yearly Flow Trends</Text>
            <Text style={styles.flowTrendCtaArrow}>↗</Text>
          </View>
        </TouchableOpacity>
      )}

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
              <Text style={styles.sectionTitle}>28-Day Consistency Matrix</Text>
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>{consistencyPct}% Consistent</Text>
              </View>
            </View>

            {/* Matrix Summary Stats Row */}
            <View style={styles.matrixStatsRow}>
              <View style={styles.matrixStatPill}>
                <Text style={styles.matrixStatValue}>{activeDaysCount} / 28</Text>
                <Text style={styles.matrixStatLabel}>Active Days</Text>
              </View>
              <View style={styles.matrixStatPill}>
                <Text style={styles.matrixStatValue}>
                  🔥 {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}
                </Text>
                <Text style={styles.matrixStatLabel}>Current Streak</Text>
              </View>
            </View>

            {/* Weekday Column Headers */}
            <View style={styles.weekdayRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, dIdx) => (
                <Text key={dIdx} style={styles.weekdayHeader}>
                  {day}
                </Text>
              ))}
            </View>

            {/* 4x7 Squircle Heatmap Grid */}
            <View style={styles.heatmapGrid}>
              {heatmap.map((cell, idx) => {
                const cellStyle =
                  cell.level === 3
                    ? styles.heatCell3
                    : cell.level === 2
                    ? styles.heatCell2
                    : cell.level === 1
                    ? styles.heatCell1
                    : styles.heatCell0;

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

      {/* Flow Score Monthly & Yearly Dot-Line Graph Trends Modal */}
      <FlowTrendsModal
        visible={showTrendsModal}
        onClose={() => setShowTrendsModal(false)}
        tasks={allTasks.length > 0 ? allTasks : tasks}
        historyEvents={historyEvents}
        theme={theme}
        isDark={isDark}
      />
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
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    flowHeroCard: {
      backgroundColor: isDark ? '#0F172A' : theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.35)',
      shadowColor: isDark ? '#38BDF8' : '#0284C7',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.35 : 0.20,
      shadowRadius: 14,
      elevation: 6,
    },
    flowHeroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    flowHeroHeaderLeft: {
      flex: 1,
      marginRight: 12,
    },
    levelBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 3,
    },
    levelBadgeIcon: {
      fontSize: 16,
    },
    levelBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#38BDF8',
      letterSpacing: 0.6,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    flowStatusTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    scoreCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
      borderWidth: 1.5,
      borderColor: '#38BDF8',
    },
    scoreNumber: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#38BDF8' : theme.colors.primary,
      lineHeight: 24,
    },
    scoreUnit: {
      fontSize: 8.5,
      fontWeight: '800',
      color: isDark ? '#38BDF8' : theme.colors.primary,
      letterSpacing: 0.8,
    },
    flowMotivationalText: {
      fontSize: 13,
      color: isDark ? '#CBD5E1' : '#475569',
      lineHeight: 18,
      marginTop: 10,
      marginBottom: 12,
    },
    levelProgressContainer: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 10,
      marginBottom: 12,
    },
    levelProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    levelProgressLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    levelNextLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#38BDF8',
    },
    levelProgressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
    },
    levelProgressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: '#38BDF8',
    },
    flowPillarsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    pillarItem: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.sm,
      paddingVertical: 7,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    pillarValue: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    pillarLabel: {
      fontSize: 9.5,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    flowTrendCtaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: theme.radius.full,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)',
      gap: 6,
    },
    flowTrendCtaText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#38BDF8',
    },
    flowTrendCtaArrow: {
      fontSize: 12,
      fontWeight: '800',
      color: '#38BDF8',
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
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: theme.radius.sm,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    tabButtonText: {
      fontSize: 13,
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
      fontSize: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
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
      fontSize: 12,
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
      fontSize: 11.5,
      fontWeight: '800',
      color: '#38BDF8',
    },
    resilienceNarrative: {
      fontSize: 13.5,
      color: isDark ? '#CBD5E1' : '#334155',
      lineHeight: 19,
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
      fontSize: 22,
      fontWeight: '800',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    metricLabel: {
      fontSize: 11.5,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    footerNote: {
      fontSize: 12,
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
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flex: 1,
    },
    goalMiniMilestone: {
      fontSize: 11.5,
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
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    matrixStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    matrixStatPill: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    matrixStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    matrixStatLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    weekdayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    weekdayHeader: {
      width: '13%',
      textAlign: 'center',
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textMuted,
    },
    heatmapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    heatCellWrapper: {
      width: '13%',
      alignItems: 'center',
      marginVertical: 3,
    },
    heatCell: {
      width: 28,
      height: 28,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    },
    heatCell0: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    },
    heatCell1: {
      backgroundColor: 'rgba(56, 189, 248, 0.35)',
      borderColor: 'rgba(56, 189, 248, 0.5)',
    },
    heatCell2: {
      backgroundColor: '#38BDF8',
      borderColor: '#38BDF8',
    },
    heatCell3: {
      backgroundColor: '#A855F7',
      borderColor: '#A855F7',
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
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    peakBadge: {
      fontSize: 12,
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
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    distLabel: {
      fontSize: 11,
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
      paddingVertical: 7,
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
      fontSize: 12.5,
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
      fontSize: 11,
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
      fontSize: 11.5,
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
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    highlightLabel: {
      fontSize: 11,
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
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    monthlySub: {
      fontSize: 12,
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
      fontSize: 13,
    },
  });
