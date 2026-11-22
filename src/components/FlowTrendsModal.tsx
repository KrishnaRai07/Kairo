import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Line,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { Task, TaskHistoryEvent } from '../types/task';
import { Theme } from '../theme/theme';
import { computeMonthlyFlowTrend, computeYearlyFlowTrend } from '../services/analyticsService';
import { triggerSelectionHaptic } from '../services/hapticsService';

interface FlowTrendsModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  historyEvents: TaskHistoryEvent[];
  theme: Theme;
  isDark: boolean;
  enableHaptics?: boolean;
}

export const FlowTrendsModal: React.FC<FlowTrendsModalProps> = ({
  visible,
  onClose,
  tasks,
  historyEvents,
  theme,
  isDark,
  enableHaptics = true,
}) => {
  const currentDate = new Date();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0-11

  // Selected point for interactive tooltip inspector
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenWidth - 40);
  const chartHeight = 220;
  const paddingLeft = 32;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 32;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Compute Trends
  const monthlyData = useMemo(() => {
    return computeMonthlyFlowTrend(tasks, historyEvents, selectedYear, selectedMonth);
  }, [tasks, historyEvents, selectedYear, selectedMonth]);

  const yearlyData = useMemo(() => {
    return computeYearlyFlowTrend(tasks, historyEvents, selectedYear);
  }, [tasks, historyEvents, selectedYear]);

  // Handlers for Period and Date Navigation
  const handlePrev = () => {
    triggerSelectionHaptic(enableHaptics);
    if (period === 'monthly') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
      setSelectedDayIndex(null);
    } else {
      setSelectedYear((y) => y - 1);
      setSelectedMonthIndex(null);
    }
  };

  const handleNext = () => {
    triggerSelectionHaptic(enableHaptics);
    if (period === 'monthly') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
      setSelectedDayIndex(null);
    } else {
      setSelectedYear((y) => y + 1);
      setSelectedMonthIndex(null);
    }
  };

  const isCurrentMonthOrFuture =
    selectedYear > currentDate.getFullYear() ||
    (selectedYear === currentDate.getFullYear() && selectedMonth >= currentDate.getMonth());

  const isCurrentYearOrFuture = selectedYear >= currentDate.getFullYear();

  // Mapping coordinates for Monthly Chart
  const monthlyPoints = useMemo(() => {
    const totalDays = monthlyData.days.length;
    return monthlyData.days.map((d, index) => {
      const x = paddingLeft + (index / Math.max(1, totalDays - 1)) * innerWidth;
      const y = paddingTop + (1 - d.score / 100) * innerHeight;
      return { ...d, x, y };
    });
  }, [monthlyData, innerWidth, innerHeight]);

  // Construct SVG Path for Monthly Line & Fill
  const { monthlyLinePath, monthlyAreaPath } = useMemo(() => {
    if (monthlyPoints.length === 0) return { monthlyLinePath: '', monthlyAreaPath: '' };

    // Filter points that have activity, or use all points
    // When plotting daily flow score, connect consecutive days or active days
    const activePoints = monthlyPoints.filter((p) => p.hasActivity);
    const pointsToDraw = activePoints.length > 1 ? activePoints : monthlyPoints;

    let lineD = `M ${pointsToDraw[0].x} ${pointsToDraw[0].y}`;
    for (let i = 1; i < pointsToDraw.length; i++) {
      lineD += ` L ${pointsToDraw[i].x} ${pointsToDraw[i].y}`;
    }

    const firstPoint = pointsToDraw[0];
    const lastPoint = pointsToDraw[pointsToDraw.length - 1];
    const baselineY = paddingTop + innerHeight;
    const areaD = `${lineD} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;

    return { monthlyLinePath: lineD, monthlyAreaPath: areaD };
  }, [monthlyPoints, innerHeight]);

  // Mapping coordinates for Yearly Chart
  const yearlyPoints = useMemo(() => {
    return yearlyData.months.map((m, index) => {
      const x = paddingLeft + (index / 11) * innerWidth;
      const y = paddingTop + (1 - m.avgScore / 100) * innerHeight;
      return { ...m, x, y };
    });
  }, [yearlyData, innerWidth, innerHeight]);

  // Construct SVG Path for Yearly Line & Fill
  const { yearlyLinePath, yearlyAreaPath } = useMemo(() => {
    const activeMonths = yearlyPoints.filter((m) => m.hasActivity);
    if (activeMonths.length === 0) return { yearlyLinePath: '', yearlyAreaPath: '' };

    const pointsToDraw = activeMonths.length > 1 ? activeMonths : yearlyPoints;
    let lineD = `M ${pointsToDraw[0].x} ${pointsToDraw[0].y}`;
    for (let i = 1; i < pointsToDraw.length; i++) {
      lineD += ` L ${pointsToDraw[i].x} ${pointsToDraw[i].y}`;
    }

    const firstPoint = pointsToDraw[0];
    const lastPoint = pointsToDraw[pointsToDraw.length - 1];
    const baselineY = paddingTop + innerHeight;
    const areaD = `${lineD} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;

    return { yearlyLinePath: lineD, yearlyAreaPath: areaD };
  }, [yearlyPoints, innerHeight]);

  // Benchmark line Y (Score 80)
  const benchmarkY = paddingTop + (1 - 80 / 100) * innerHeight;

  // Selected Active Point Details
  const activeMonthlyPoint =
    selectedDayIndex !== null && monthlyPoints[selectedDayIndex]
      ? monthlyPoints[selectedDayIndex]
      : monthlyPoints.find((p) => p.dayNumber === currentDate.getDate()) || monthlyPoints[0];

  const activeYearlyPoint =
    selectedMonthIndex !== null && yearlyPoints[selectedMonthIndex]
      ? yearlyPoints[selectedMonthIndex]
      : yearlyPoints[selectedMonth] || yearlyPoints[0];

  const styles = getStyles(theme, isDark);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Flow Score Trends</Text>
              <Text style={styles.headerSubtitle}>
                {period === 'monthly' ? 'Daily Date vs Flow Score' : 'Monthly Avg Flow Trajectory'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                triggerSelectionHaptic(enableHaptics);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Period Switcher (Segmented Control) */}
            <View style={styles.periodSwitcher}>
              <TouchableOpacity
                style={[styles.periodOption, period === 'monthly' && styles.periodOptionActive]}
                onPress={() => {
                  triggerSelectionHaptic(enableHaptics);
                  setPeriod('monthly');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    period === 'monthly' && styles.periodOptionTextActive,
                  ]}
                >
                  📅 Monthly (Daily)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.periodOption, period === 'yearly' && styles.periodOptionActive]}
                onPress={() => {
                  triggerSelectionHaptic(enableHaptics);
                  setPeriod('yearly');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    period === 'yearly' && styles.periodOptionTextActive,
                  ]}
                >
                  📆 Yearly (Months)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date / Month Navigator */}
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.navArrowBtn} onPress={handlePrev} activeOpacity={0.7}>
                <Text style={styles.navArrowText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.navTitle}>
                {period === 'monthly' ? monthlyData.monthName : `${selectedYear} Overview`}
              </Text>
              <TouchableOpacity
                style={[
                  styles.navArrowBtn,
                  (period === 'monthly' ? isCurrentMonthOrFuture : isCurrentYearOrFuture) &&
                    styles.navArrowBtnDisabled,
                ]}
                onPress={handleNext}
                disabled={period === 'monthly' ? isCurrentMonthOrFuture : isCurrentYearOrFuture}
                activeOpacity={0.7}
              >
                <Text style={styles.navArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Summary Metrics Cards */}
            <View style={styles.summaryGrid}>
              {period === 'monthly' ? (
                <>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Month Avg</Text>
                    <Text style={styles.summaryCardValue}>{monthlyData.averageScore}</Text>
                    <Text style={styles.summaryCardSub}>Target 80+</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Peak Day</Text>
                    <Text style={[styles.summaryCardValue, { color: '#38BDF8' }]}>
                      {monthlyData.peakScore}
                    </Text>
                    <Text style={styles.summaryCardSub}>High Score 🔥</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Mastery Days</Text>
                    <Text style={[styles.summaryCardValue, { color: '#10B981' }]}>
                      {monthlyData.masteryDays}d
                    </Text>
                    <Text style={styles.summaryCardSub}>Score ≥ 80</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Yearly Avg</Text>
                    <Text style={styles.summaryCardValue}>{yearlyData.annualAverage}</Text>
                    <Text style={styles.summaryCardSub}>12-Month Mean</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Best Month</Text>
                    <Text style={[styles.summaryCardValue, { color: '#38BDF8', fontSize: 16 }]}>
                      {yearlyData.bestMonth}
                    </Text>
                    <Text style={styles.summaryCardSub}>Peak Rhythms</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Active Months</Text>
                    <Text style={[styles.summaryCardValue, { color: '#10B981' }]}>
                      {yearlyData.activeMonths}/12
                    </Text>
                    <Text style={styles.summaryCardSub}>Consistency</Text>
                  </View>
                </>
              )}
            </View>

            {/* Active Selected Point Inspector Card */}
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorRow}>
                <View>
                  <Text style={styles.inspectorDate}>
                    {period === 'monthly'
                      ? `Day ${activeMonthlyPoint?.dayNumber} · ${monthlyData.monthName.split(' ')[0]}`
                      : `${activeYearlyPoint?.monthLabel} ${selectedYear}`}
                  </Text>
                  <Text style={styles.inspectorSub}>
                    {period === 'monthly'
                      ? activeMonthlyPoint?.hasActivity
                        ? `${activeMonthlyPoint.completedTasks}/${activeMonthlyPoint.plannedTasks} tasks completed`
                        : 'No tasks scheduled'
                      : activeYearlyPoint?.hasActivity
                      ? `${activeYearlyPoint.activeDays} active days recorded`
                      : 'No activity recorded'}
                  </Text>
                </View>

                <View style={styles.inspectorScoreBadge}>
                  <Text style={styles.inspectorScoreNumber}>
                    {period === 'monthly' ? activeMonthlyPoint?.score : activeYearlyPoint?.avgScore}
                  </Text>
                  <Text style={styles.inspectorScoreLabel}>FLOW</Text>
                </View>
              </View>
            </View>

            {/* Interactive Dot-Line Chart Container */}
            <View style={styles.chartCard}>
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#38BDF8" stopOpacity="0.35" />
                    <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                {/* Y-Axis Grid Lines & Reference Values */}
                {[0, 25, 50, 75, 100].map((val) => {
                  const y = paddingTop + (1 - val / 100) * innerHeight;
                  return (
                    <React.Fragment key={val}>
                      <Line
                        x1={paddingLeft}
                        y1={y}
                        x2={chartWidth - paddingRight}
                        y2={y}
                        stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                        strokeWidth="1"
                      />
                      <SvgText
                        x={paddingLeft - 8}
                        y={y + 4}
                        fill={theme.colors.textMuted}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {val}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Benchmark Line (Score 80 Mastery Target) */}
                <Line
                  x1={paddingLeft}
                  y1={benchmarkY}
                  x2={chartWidth - paddingRight}
                  y2={benchmarkY}
                  stroke="#F59E0B"
                  strokeWidth="1.4"
                  strokeDasharray="4 4"
                  strokeOpacity="0.8"
                />
                <SvgText
                  x={chartWidth - paddingRight}
                  y={benchmarkY - 5}
                  fill="#F59E0B"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="end"
                >
                  80 Flow Mastery Target
                </SvgText>

                {/* Shaded Area Under Line */}
                {period === 'monthly' && monthlyAreaPath ? (
                  <Path d={monthlyAreaPath} fill="url(#chartGradient)" />
                ) : null}
                {period === 'yearly' && yearlyAreaPath ? (
                  <Path d={yearlyAreaPath} fill="url(#chartGradient)" />
                ) : null}

                {/* Connected Glowing Line */}
                {period === 'monthly' && monthlyLinePath ? (
                  <Path
                    d={monthlyLinePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {period === 'yearly' && yearlyLinePath ? (
                  <Path
                    d={yearlyLinePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Monthly Dots */}
                {period === 'monthly' &&
                  monthlyPoints.map((p, idx) => {
                    const isSelected =
                      selectedDayIndex === idx ||
                      (selectedDayIndex === null && p.dayNumber === activeMonthlyPoint?.dayNumber);
                    const isMastery = p.score >= 80;

                    return (
                      <React.Fragment key={`dot-${p.dayNumber}`}>
                        {isSelected && (
                          <Circle
                            cx={p.x}
                            cy={p.y}
                            r="8"
                            fill="rgba(56, 189, 248, 0.25)"
                          />
                        )}
                        <Circle
                          cx={p.x}
                          cy={p.y}
                          r={isSelected ? 5.5 : p.hasActivity ? 3.5 : 2}
                          fill={
                            p.hasActivity
                              ? isMastery
                                ? '#38BDF8'
                                : '#0284C7'
                              : isDark
                              ? '#334155'
                              : '#CBD5E1'
                          }
                          stroke={isSelected ? '#FFFFFF' : isDark ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                      </React.Fragment>
                    );
                  })}

                {/* Yearly Dots */}
                {period === 'yearly' &&
                  yearlyPoints.map((m, idx) => {
                    const isSelected =
                      selectedMonthIndex === idx ||
                      (selectedMonthIndex === null && m.monthIndex === activeYearlyPoint?.monthIndex);
                    const isMastery = m.avgScore >= 80;

                    return (
                      <React.Fragment key={`ydot-${m.monthIndex}`}>
                        {isSelected && (
                          <Circle
                            cx={m.x}
                            cy={m.y}
                            r="8"
                            fill="rgba(56, 189, 248, 0.25)"
                          />
                        )}
                        <Circle
                          cx={m.x}
                          cy={m.y}
                          r={isSelected ? 6 : m.hasActivity ? 4 : 2.5}
                          fill={
                            m.hasActivity
                              ? isMastery
                                ? '#38BDF8'
                                : '#0284C7'
                              : isDark
                              ? '#334155'
                              : '#CBD5E1'
                          }
                          stroke={isSelected ? '#FFFFFF' : isDark ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                      </React.Fragment>
                    );
                  })}

                {/* X-Axis Tick Labels */}
                {period === 'monthly' ? (
                  // Show ticks for days 1, 5, 10, 15, 20, 25, and last day
                  monthlyPoints
                    .filter(
                      (p) =>
                        p.dayNumber === 1 ||
                        p.dayNumber % 5 === 0 ||
                        p.dayNumber === monthlyPoints.length
                    )
                    .map((p) => (
                      <SvgText
                        key={`lbl-${p.dayNumber}`}
                        x={p.x}
                        y={chartHeight - 10}
                        fill={theme.colors.textMuted}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {p.dayNumber}
                      </SvgText>
                    ))
                ) : (
                  // Show 12 months labels
                  yearlyPoints.map((m) => (
                    <SvgText
                      key={`ylbl-${m.monthIndex}`}
                      x={m.x}
                      y={chartHeight - 10}
                      fill={theme.colors.textMuted}
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {m.monthLabel}
                    </SvgText>
                  ))
                )}
              </Svg>

              {/* Invisible Touch Column Overlay to select dots comfortably */}
              <View style={[StyleSheet.absoluteFill, { left: paddingLeft, right: paddingRight }]}>
                <View style={styles.touchColumnsRow}>
                  {period === 'monthly'
                    ? monthlyPoints.map((p, idx) => (
                        <TouchableOpacity
                          key={`touch-${p.dayNumber}`}
                          style={styles.touchColumn}
                          onPress={() => {
                            triggerSelectionHaptic(enableHaptics);
                            setSelectedDayIndex(idx);
                          }}
                          activeOpacity={0.7}
                        />
                      ))
                    : yearlyPoints.map((m, idx) => (
                        <TouchableOpacity
                          key={`ytouch-${m.monthIndex}`}
                          style={styles.touchColumn}
                          onPress={() => {
                            triggerSelectionHaptic(enableHaptics);
                            setSelectedMonthIndex(idx);
                          }}
                          activeOpacity={0.7}
                        />
                      ))}
                </View>
              </View>
            </View>

            {/* Flow Trajectory Guidance Note */}
            <View style={styles.insightNoteCard}>
              <Text style={styles.insightNoteIcon}>💡</Text>
              <Text style={styles.insightNoteText}>
                {period === 'monthly'
                  ? 'Consistency counts more than single-day spikes. Maintaining scores consistently above 80 locks your Flow Mastery Levels permanently.'
                  : 'Your yearly curve visualizes compounding discipline. Strive to keep monthly averages steadily in the cyan Flow zone.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      paddingTop: 18,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : theme.colors.borderSubtle,
      ...theme.shadows.modal,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12.5,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    periodSwitcher: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      padding: 4,
      marginBottom: 12,
    },
    periodOption: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: theme.radius.sm,
    },
    periodOptionActive: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.18)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    periodOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    periodOptionTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceSecondary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : theme.colors.borderSubtle,
    },
    navArrowBtn: {
      padding: 6,
    },
    navArrowBtnDisabled: {
      opacity: 0.3,
    },
    navArrowText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    navTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    summaryGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : theme.colors.borderSubtle,
    },
    summaryCardLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginBottom: 2,
    },
    summaryCardValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    summaryCardSub: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    inspectorCard: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)',
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
    },
    inspectorRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inspectorDate: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    inspectorSub: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    inspectorScoreBadge: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#FFFFFF',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: '#38BDF8',
    },
    inspectorScoreNumber: {
      fontSize: 18,
      fontWeight: '800',
      color: '#38BDF8',
    },
    inspectorScoreLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.textMuted,
    },
    chartCard: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.lg,
      paddingTop: 8,
      paddingBottom: 4,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1.2,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)',
      overflow: 'hidden',
    },
    touchColumnsRow: {
      flex: 1,
      flexDirection: 'row',
    },
    touchColumn: {
      flex: 1,
      height: '100%',
    },
    insightNoteCard: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : theme.colors.surfaceSecondary,
      padding: 12,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.borderSubtle,
    },
    insightNoteIcon: {
      fontSize: 16,
    },
    insightNoteText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
  });
