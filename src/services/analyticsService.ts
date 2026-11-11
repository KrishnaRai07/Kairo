import {
  Task,
  TaskHistoryEvent,
  DayMetrics,
  WeeklyTrend,
  MonthlyTrend,
  ResilienceMetrics,
  FocusTimeDistribution,
  HeatmapDay,
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

