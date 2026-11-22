
import {
  Task,
  TaskHistoryEvent,
  DayMetrics,
  WeeklyTrend,
  MonthlyTrend,
  ResilienceMetrics,
  FocusTimeDistribution,
  HeatmapDay,
  FlowScoreMetrics,
  FlowMasteryLevel,
} from '../types/task';
import { getWeekBoundaries, getMonthBoundaries, isSameDay } from '../utils/dateUtils';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Computes daily metrics for a specific date given a list of tasks.
 */
export function computeDayMetrics(tasksForDay: Task[], targetDate: Date): DayMetrics {
  const dateStr = targetDate.toISOString().split('T')[0];
  const dayLabel = DAY_LABELS[targetDate.getDay()];

  let completed = 0;
  let completedLate = 0;
  let missed = 0;
  let skipped = 0;
  let scheduledMinutes = 0;

  for (const t of tasksForDay) {
    const startMs = new Date(t.startTime).getTime();
    const endMs = new Date(t.endTime).getTime();
    const durMins = Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));
    scheduledMinutes += durMins;

    if (t.status === 'completed') {
      completed++;
      if (t.completedAt && new Date(t.completedAt).getTime() > endMs) {
        completedLate++;
      }
    } else if (t.status === 'missed') {
      missed++;
    } else if (t.status === 'skipped') {
      skipped++;
    }
  }

  const totalPlanned = tasksForDay.length;
  const completionRate = totalPlanned > 0 ? completed / totalPlanned : 0;

  return {
    date: dateStr,
    dayLabel,
    totalPlanned,
    completed,
    completedLate,
    missed,
    skipped,
    completionRate,
    scheduledMinutes,
  };
}

/**
 * Computes a 7-day weekly trend from Monday to Sunday.
 */
export function computeWeeklyTrend(
  tasks: Task[],
  historyEvents: TaskHistoryEvent[],
  referenceDate: Date = new Date()
): WeeklyTrend {
  const { startOfWeek, endOfWeek, days } = getWeekBoundaries(referenceDate);

  const dayMetricsList: DayMetrics[] = days.map((dayDate) => {
    const dayTasks = tasks.filter((t) => {
      const taskStart = new Date(t.startTime);
      return isSameDay(taskStart, dayDate);
    });
    return computeDayMetrics(dayTasks, dayDate);
  });

  const totalPlanned = dayMetricsList.reduce((acc, d) => acc + d.totalPlanned, 0);
  const totalCompleted = dayMetricsList.reduce((acc, d) => acc + d.completed, 0);
  const averageCompletionRate = totalPlanned > 0 ? totalCompleted / totalPlanned : 0;

  // Filter history events falling within week
  const startMs = new Date(startOfWeek).getTime();
  const endMs = new Date(endOfWeek).getTime();

  const weekEvents = historyEvents.filter((ev) => {
    const evMs = new Date(ev.timestamp).getTime();
    return evMs >= startMs && evMs <= endMs;
  });

  const lateRecoveryCount = weekEvents.filter((ev) => ev.eventType === 'completed_late').length;
  const rescheduleCount = weekEvents.filter((ev) => ev.eventType === 'rescheduled').length;

  // Find most productive day
  let bestDayIndex = -1;
  let maxCompleted = 0;
  dayMetricsList.forEach((dm, index) => {
    if (dm.completed > maxCompleted) {
      maxCompleted = dm.completed;
      bestDayIndex = index;
    }
  });

  const mostProductiveDay =
    bestDayIndex >= 0 ? FULL_DAY_NAMES[days[bestDayIndex].getDay()] : undefined;

  return {
    startDate: startOfWeek,
    endDate: endOfWeek,
    days: dayMetricsList,
    totalPlanned,
    totalCompleted,
    lateRecoveryCount,
    rescheduleCount,
    averageCompletionRate,
    mostProductiveDay,
  };
}

/**
 * Computes monthly aggregated metrics.
 */
export function computeMonthlyMetrics(
  tasks: Task[],
  historyEvents: TaskHistoryEvent[],
  referenceDate: Date = new Date()
): MonthlyTrend {
  const { startOfMonth, endOfMonth } = getMonthBoundaries(referenceDate);
  const startMs = new Date(startOfMonth).getTime();
  const endMs = new Date(endOfMonth).getTime();

  const monthTasks = tasks.filter((t) => {
    const tMs = new Date(t.startTime).getTime();
    return tMs >= startMs && tMs <= endMs;
  });

  let totalCompleted = 0;
  let completedLate = 0;
  let missed = 0;
  let skipped = 0;
  let totalScheduledMins = 0;

  for (const t of monthTasks) {
    const tStart = new Date(t.startTime).getTime();
    const tEnd = new Date(t.endTime).getTime();
    totalScheduledMins += Math.max(0, Math.round((tEnd - tStart) / (1000 * 60)));

    if (t.status === 'completed') {
      totalCompleted++;
      if (t.completedAt && new Date(t.completedAt).getTime() > tEnd) {
        completedLate++;
      }
    } else if (t.status === 'missed') {
      missed++;
    } else if (t.status === 'skipped') {
      skipped++;
    }
  }

  const monthEvents = historyEvents.filter((ev) => {
    const evMs = new Date(ev.timestamp).getTime();
    return evMs >= startMs && evMs <= endMs;
  });

  const rescheduledCount = monthEvents.filter((ev) => ev.eventType === 'rescheduled').length;
  const totalPlanned = monthTasks.length;
  const overallCompletionRate = totalPlanned > 0 ? totalCompleted / totalPlanned : 0;
  const totalScheduledHours = Math.round((totalScheduledMins / 60) * 10) / 10;

  return {
    totalPlanned,
    totalCompleted,
    completedLate,
    missed,
    skipped,
    rescheduledCount,
    overallCompletionRate,
    totalScheduledHours,
  };
}

/**
 * Computes Kairo's signature Resilience & Psychological Recovery Metric.
 * Measures how well the user recovers from life disruptions (late completions + reschedules).
 */
export function computeResilienceMetrics(
  tasks: Task[],
  historyEvents: TaskHistoryEvent[]
): ResilienceMetrics {
  const lateEvents = historyEvents.filter((e) => e.eventType === 'completed_late').length;
  const rescheduleEvents = historyEvents.filter((e) => e.eventType === 'rescheduled').length;
  const unrecoveredMissed = tasks.filter((t) => t.status === 'missed').length;

  const recoveredCount = lateEvents + rescheduleEvents;
  const totalDisruptions = recoveredCount + unrecoveredMissed;

  const resilienceScore = totalDisruptions > 0 
    ? Math.round((recoveredCount / totalDisruptions) * 100) 
    : 100;

  return {
    totalDisruptions,
    recoveredCount,
    resilienceScore,
    unrecoveredMissed,
  };
}

/**
 * Computes focus time distribution across Morning, Afternoon, and Evening.
 */
export function computeFocusTimeDistribution(tasks: Task[]): FocusTimeDistribution {
  let morningMins = 0;
  let afternoonMins = 0;
  let eveningMins = 0;

  for (const t of tasks) {
    if (t.status !== 'completed') continue;
    const d = new Date(t.startTime);
    const h = d.getHours();
    const durMins = Math.max(0, Math.round((new Date(t.endTime).getTime() - d.getTime()) / 60000));

    if (h >= 5 && h < 12) {
      morningMins += durMins;
    } else if (h >= 12 && h < 17) {
      afternoonMins += durMins;
    } else {
      eveningMins += durMins;
    }
  }

  const morningHours = Math.round((morningMins / 60) * 10) / 10;
  const afternoonHours = Math.round((afternoonMins / 60) * 10) / 10;
  const eveningHours = Math.round((eveningMins / 60) * 10) / 10;

  let peakWindow = 'Morning (5 AM – 12 PM)';
  if (afternoonHours > morningHours && afternoonHours >= eveningHours) {
    peakWindow = 'Afternoon (12 PM – 5 PM)';
  } else if (eveningHours > morningHours && eveningHours > afternoonHours) {
    peakWindow = 'Evening (5 PM – 12 AM)';
  }

  return {
    morningHours,
    afternoonHours,
    eveningHours,
    peakWindow,
  };
}

/**
 * Computes a 28-day habit & consistency heatmap (4 weeks of 7 days).
 */
export function computeActivityHeatmap(
  tasks: Task[],
  referenceDate: Date = new Date(),
  numDays: number = 28
): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (numDays - 1));

  for (let i = 0; i < numDays; i++) {
    const cur = new Date(start);
    cur.setDate(cur.getDate() + i);

    const completedCount = tasks.filter((t) => {
      if (t.status !== 'completed') return false;
      return isSameDay(new Date(t.startTime), cur);
    }).length;

    let level: 0 | 1 | 2 | 3 = 0;
    if (completedCount >= 3) level = 3;
    else if (completedCount === 2) level = 2;
    else if (completedCount === 1) level = 1;

    result.push({
      date: cur.toISOString().split('T')[0],
      dayLabel: DAY_LABELS[cur.getDay()][0],
      completedCount,
      level,
    });
  }

  return result;
}

/**
 * Evaluates the user's holistic Flow Score (0-100) and Flow Mastery Level.
 * Balanced across 4 core pillars:
 * 1. Execution Momentum (40%) - Completed and recovered late tasks
 * 2. Resilience & Recovery (30%) - Handling disruptions without giving up
 * 3. Habit Rhythm & Consistency (20%) - 28-day active habit density
 * 4. Intentional Pacing (10%) - Avoiding cognitive overload
 *
 * Mastery Level Ladder (Days + Consistency Gate):
 * Lvl 1: Spark 🌱 (Day 1-7 >= 65 score)
 * Lvl 2: Rhythm Builder 🌊 (14 days >= 75 score)
 * Lvl 3: Flow Keeper ⚡ (30 active days >= 80 score) -> The 1-Month Milestone!
 * Lvl 4: Deep Resilient 🛡️ (60 active days >= 85 score)
 * Lvl 5: Kairo Architect 👑 (90 active days >= 90 score)
 */
export function computeFlowScoreAndMastery(
  tasks: Task[],
  historyEvents: TaskHistoryEvent[] = [],
  referenceDate: Date = new Date()
): FlowScoreMetrics {
  const dayMetrics = computeDayMetrics(
    tasks.filter((t) => isSameDay(new Date(t.startTime), referenceDate)),
    referenceDate
  );

  // 1. Execution Score (40%)
  let executionScore = 0;
  if (dayMetrics.totalPlanned > 0) {
    const onTimeCompleted = Math.max(0, dayMetrics.completed - dayMetrics.completedLate);
    const raw = (onTimeCompleted * 1.0 + dayMetrics.completedLate * 0.85) / dayMetrics.totalPlanned;
    executionScore = Math.min(100, Math.max(0, Math.round(raw * 100)));
  } else {
    const past7Start = new Date(referenceDate);
    past7Start.setDate(past7Start.getDate() - 7);
    const past7Tasks = tasks.filter((t) => {
      const d = new Date(t.startTime);
      return d >= past7Start && d <= referenceDate;
    });
    if (past7Tasks.length > 0) {
      const done = past7Tasks.filter((t) => t.status === 'completed').length;
      executionScore = Math.min(100, Math.max(0, Math.round((done / past7Tasks.length) * 100)));
    } else {
      executionScore = 75;
    }
  }

  // 2. Resilience Score (30%)
  const resMetrics = computeResilienceMetrics(tasks, historyEvents);
  const resilienceScore = resMetrics.resilienceScore;

  // 3. Consistency Score (20%)
  const heatmap = computeActivityHeatmap(tasks, referenceDate, 28);
  const activeDaysCount = heatmap.filter((d) => d.completedCount > 0).length;
  const consistencyScore = Math.min(100, Math.round((activeDaysCount / 28) * 100));

  // 4. Pacing Score (10%)
  const taskCount = dayMetrics.totalPlanned;
  let pacingScore = 80;
  if (taskCount >= 2 && taskCount <= 6) {
    pacingScore = 100;
  } else if (taskCount === 1) {
    pacingScore = 85;
  } else if (taskCount >= 7 && taskCount <= 9) {
    pacingScore = 70;
  } else if (taskCount > 9) {
    pacingScore = 55;
  } else {
    pacingScore = 75;
  }

  // Weighted Overall Flow Score
  const overallScore = Math.min(
    100,
    Math.max(
      10,
      Math.round(
        executionScore * 0.40 +
        resilienceScore * 0.30 +
        consistencyScore * 0.20 +
        pacingScore * 0.10
      )
    )
  );

  // Status & Motivation
  let statusRating: 'peak' | 'steady' | 'building' | 'recharge' = 'steady';
  let statusLabel = 'Steady Momentum';
  let motivationalMessage = 'Strong, balanced rhythm. Consistency is compounding.';

  if (overallScore >= 90) {
    statusRating = 'peak';
    statusLabel = 'Peak Flow';
    motivationalMessage = 'Unstoppable clarity. You are executing with calm precision.';
  } else if (overallScore >= 75) {
    statusRating = 'steady';
    statusLabel = 'Steady Momentum';
    motivationalMessage = 'Strong, balanced rhythm. Consistency is compounding.';
  } else if (overallScore >= 50) {
    statusRating = 'building';
    statusLabel = 'Building Rhythm';
    motivationalMessage = 'Good persistence. Keep taking one intentional step at a time.';
  } else {
    statusRating = 'recharge';
    statusLabel = 'Recharging State';
    motivationalMessage = 'Heavy day? Take a breath. Start fresh with just one small focus.';
  }

  // 5. Evaluate historical daily scores (up to 90 days)
  let daysAbove65 = 0;
  let daysAbove75 = 0;
  let daysAbove80 = 0;
  let daysAbove85 = 0;
  let daysAbove90 = 0;

  for (let d = 0; d < 90; d++) {
    const checkDate = new Date(referenceDate);
    checkDate.setDate(checkDate.getDate() - d);
    const dayTasks = tasks.filter((t) => isSameDay(new Date(t.startTime), checkDate));
    if (dayTasks.length > 0) {
      const completed = dayTasks.filter((t) => t.status === 'completed').length;
      const rate = completed / dayTasks.length;
      const approxDayScore = Math.round(rate * 60 + 40);
      if (approxDayScore >= 90) daysAbove90++;
      if (approxDayScore >= 85) daysAbove85++;
      if (approxDayScore >= 80) daysAbove80++;
      if (approxDayScore >= 75) daysAbove75++;
      if (approxDayScore >= 65) daysAbove65++;
    }
  }

  // Determine Level Ladder
  let masteryLevel: FlowMasteryLevel;

  if (daysAbove90 >= 90) {
    masteryLevel = {
      level: 5,
      tier: 'architect',
      title: 'Kairo Architect',
      badge: '👑',
      targetDays: 90,
      minScoreThreshold: 90,
      qualifiedDays: daysAbove90,
      progressPercent: 100,
      isUnlocked: true,
      nextLevelTitle: 'Max Mastery Achieved',
      daysRemainingForNext: 0,
    };
  } else if (daysAbove85 >= 60) {
    masteryLevel = {
      level: 4,
      tier: 'resilient',
      title: 'Deep Resilient',
      badge: '🛡️',
      targetDays: 90,
      minScoreThreshold: 90,
      qualifiedDays: daysAbove90,
      progressPercent: Math.min(100, Math.round((daysAbove90 / 90) * 100)),
      isUnlocked: true,
      nextLevelTitle: 'Kairo Architect (90d @ 90+)',
      daysRemainingForNext: Math.max(0, 90 - daysAbove90),
    };
  } else if (daysAbove80 >= 30) {
    masteryLevel = {
      level: 3,
      tier: 'keeper',
      title: 'Flow Keeper',
      badge: '⚡',
      targetDays: 60,
      minScoreThreshold: 85,
      qualifiedDays: daysAbove85,
      progressPercent: Math.min(100, Math.round((daysAbove85 / 60) * 100)),
      isUnlocked: true,
      nextLevelTitle: 'Deep Resilient (60d @ 85+)',
      daysRemainingForNext: Math.max(0, 60 - daysAbove85),
    };
  } else if (daysAbove75 >= 14) {
    masteryLevel = {
      level: 2,
      tier: 'builder',
      title: 'Rhythm Builder',
      badge: '🌊',
      targetDays: 30,
      minScoreThreshold: 80,
      qualifiedDays: daysAbove80,
      progressPercent: Math.min(100, Math.round((daysAbove80 / 30) * 100)),
      isUnlocked: true,
      nextLevelTitle: 'Flow Keeper (30d @ 80+)',
      daysRemainingForNext: Math.max(0, 30 - daysAbove80),
    };
  } else if (daysAbove65 >= 7) {
    masteryLevel = {
      level: 1,
      tier: 'spark',
      title: 'Spark',
      badge: '🌱',
      targetDays: 14,
      minScoreThreshold: 75,
      qualifiedDays: daysAbove75,
      progressPercent: Math.min(100, Math.round((daysAbove75 / 14) * 100)),
      isUnlocked: true,
      nextLevelTitle: 'Rhythm Builder (14d @ 75+)',
      daysRemainingForNext: Math.max(0, 14 - daysAbove75),
    };
  } else {
    masteryLevel = {
      level: 1,
      tier: 'spark',
      title: 'Spark',
      badge: '🌱',
      targetDays: 7,
      minScoreThreshold: 65,
      qualifiedDays: daysAbove65,
      progressPercent: Math.min(100, Math.round((daysAbove65 / 7) * 100)),
      isUnlocked: true,
      nextLevelTitle: 'Rhythm Builder (14d @ 75+)',
      daysRemainingForNext: Math.max(0, 7 - daysAbove65),
    };
  }

  return {
    overallScore,
    statusRating,
    statusLabel,
    motivationalMessage,
    breakdown: {
      executionScore,
      resilienceScore,
      consistencyScore,
      pacingScore,
    },
    masteryLevel,
  };
}


