export type TaskStatus = 'upcoming' | 'in_progress' | 'completed' | 'missed' | 'skipped';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string; // ISO string
  completedAt?: string | null; // ISO string when completed
  updatedAt?: string | null;   // ISO string when last modified
  goalId?: string | null;      // Link to multi-day target goal
  goalDayNumber?: number | null; // e.g. Day 4 of 30
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDays: number; // e.g. 30
  startDate: string;  // ISO or YYYY-MM-DD
  preferredTime: string; // e.g. "07:00"
  durationMinutes: number;
  priority: TaskPriority;
  createdAt: string;
}

export interface GoalProgress extends Goal {
  completedDays: number;
  totalDays: number;
  currentDayNumber: number;
  completionRate: number; // 0 to 1
}

export type HistoryEventType = 
  | 'created'
  | 'started'
  | 'completed'
  | 'completed_late'
  | 'missed'
  | 'skipped'
  | 'rescheduled'
  | 'edited';

export interface TaskHistoryEvent {
  id: string;
  taskId: string;
  eventType: HistoryEventType;
  timestamp: string; // ISO string
  oldStartTime?: string | null;
  oldEndTime?: string | null;
  newStartTime?: string | null;
  newEndTime?: string | null;
  note?: string;
}

export type ReminderTriggerType = '15min_before' | 'at_start' | 'overdue';

export interface TaskReminder {
  id: string;
  taskId: string;
  notificationId: string;
  triggerType: ReminderTriggerType;
  scheduledFor: string; // ISO string
}

export interface DayProgressSummary {
  total: number;
  completed: number;
  inProgress: number;
  upcoming: number;
  missed: number;
  skipped: number;
  completionRate: number; // 0 to 1
}

export type LockType = 'pin4' | 'pin6' | 'password';

export interface SecurityQuestion {
  id: string;
  question: string;
  placeholder: string;
}

export interface SecurityAnswerInput {
  questionId: string;
  answer: string;
}

export interface UserSettings {
  timeFormat: '12h' | '24h';
  themeMode: 'light' | 'dark';
  enable15MinReminder: boolean;
  enableStartReminder: boolean;
  enableOverdueReminder: boolean;
  defaultDurationMinutes: number;
  enableHaptics?: boolean;
  dayStartHour?: number; // e.g. 7 for 07:00 AM
  enableVoiceAlerts?: boolean;
  voiceSalutation?: string; // e.g. 'Sir', 'Boss', 'Kairo User'
  voiceLanguage?: 'en-IN' | 'hi-IN' | 'en-US';
  enableAppLock?: boolean;
  enableBiometrics?: boolean;
  lockTimeoutSeconds?: number; // 0 = immediate, 60 = 1 min grace, 300 = 5 min grace
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timeFormat: '12h',
  themeMode: 'dark',
  enable15MinReminder: true,
  enableStartReminder: true,
  enableOverdueReminder: true,
  defaultDurationMinutes: 45,
  enableHaptics: true,
  dayStartHour: 8,
  enableVoiceAlerts: true,
  voiceSalutation: 'Sir',
  voiceLanguage: 'en-IN',
  enableAppLock: false,
  enableBiometrics: true,
  lockTimeoutSeconds: 60,
};

export interface DayMetrics {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g., 'Mon'
  totalPlanned: number;
  completed: number;
  completedLate: number;
  missed: number;
  skipped: number;
  completionRate: number; // 0 to 1
  scheduledMinutes: number;
}

export interface WeeklyTrend {
  startDate: string; // ISO string
  endDate: string;   // ISO string
  days: DayMetrics[];
  totalPlanned: number;
  totalCompleted: number;
  lateRecoveryCount: number;
  rescheduleCount: number;
  averageCompletionRate: number; // 0 to 1
  mostProductiveDay?: string;
}

export interface MonthlyTrend {
  totalPlanned: number;
  totalCompleted: number;
  completedLate: number;
  missed: number;
  skipped: number;
  rescheduledCount: number;
  overallCompletionRate: number;
  totalScheduledHours: number;
}

export interface ResilienceMetrics {
  totalDisruptions: number;
  recoveredCount: number;
  resilienceScore: number; // 0 to 100%
  unrecoveredMissed: number;
}

export interface FocusTimeDistribution {
  morningHours: number;   // 05:00 - 12:00
  afternoonHours: number; // 12:00 - 17:00
  eveningHours: number;   // 17:00 - 24:00
  peakWindow: string;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // 'M', 'T', etc.
  completedCount: number;
  level: 0 | 1 | 2 | 3; // intensity 0 to 3
}

export type FlowMasteryTier = 'spark' | 'builder' | 'keeper' | 'resilient' | 'architect';

export interface FlowMasteryLevel {
  level: number; // 1 to 5
  tier: FlowMasteryTier;
  title: string; // 'Spark', 'Rhythm Builder', 'Flow Keeper', 'Deep Resilient', 'Kairo Architect'
  badge: string; // '🌱', '🌊', '⚡', '🛡️', '👑'
  targetDays: number; // 7, 14, 30, 60, 90
  minScoreThreshold: number; // 65, 75, 80, 85, 90
  qualifiedDays: number;
  progressPercent: number; // 0 to 100
  isUnlocked: boolean;
  nextLevelTitle?: string;
  daysRemainingForNext?: number;
}

export interface FlowScoreMetrics {
  overallScore: number; // 0 to 100
  statusRating: 'peak' | 'steady' | 'building' | 'recharge';
  statusLabel: string; // 'Peak Flow', 'Steady Momentum', 'Building Rhythm', 'Recharging State'
  motivationalMessage: string;
  breakdown: {
    executionScore: number; // weight 40%
    resilienceScore: number; // weight 30%
    consistencyScore: number; // weight 20%
    pacingScore: number; // weight 10%
  };
  masteryLevel: FlowMasteryLevel;
}

export interface DailyFlowPoint {
  dayNumber: number; // 1 to 31
  dateStr: string; // YYYY-MM-DD
  score: number; // 0 to 100
  plannedTasks: number;
  completedTasks: number;
  hasActivity: boolean;
  statusRating: 'peak' | 'steady' | 'building' | 'recharge' | 'empty';
}

export interface MonthlyFlowTrend {
  year: number;
  month: number; // 0 to 11
  monthName: string; // e.g. "November 2026"
  days: DailyFlowPoint[];
  averageScore: number;
  peakScore: number;
  masteryDays: number; // count of days with score >= 80
  activeDays: number;
}

export interface MonthlyFlowSummaryPoint {
  monthIndex: number; // 0 to 11
  monthLabel: string; // "Jan", "Feb", ...
  avgScore: number;
  peakScore: number;
  activeDays: number;
  hasActivity: boolean;
}

export interface YearlyFlowTrend {
  year: number;
  months: MonthlyFlowSummaryPoint[];
  annualAverage: number;
  bestMonth: string;
  masteryMonths: number;
  activeMonths: number;
}


