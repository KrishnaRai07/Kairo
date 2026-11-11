export function formatTime(isoString: string, format: '12h' | '24h' = '12h'): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const minutesFormatted = minutes < 10 ? `0${minutes}` : `${minutes}`;

  if (format === '24h') {
    const hoursFormatted = hours < 10 ? `0${hours}` : `${hours}`;
    return `${hoursFormatted}:${minutesFormatted}`;
  }

  // 12-hour format
  const ampm = hours >= 12 ? 'PM' : 'AM';
  let hour12 = hours % 12;
  hour12 = hour12 ? hour12 : 12;
  return `${hour12}:${minutesFormatted} ${ampm}`;
}

export function formatDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

export function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const diffMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const remainingMins = diffMinutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow);
}

export function getRelativeDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return formatDate(date);
}

export function getDayBoundaries(date: Date): { startOfDay: string; endOfDay: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    startOfDay: start.toISOString(),
    endOfDay: end.toISOString(),
  };
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns the 7-day week boundaries containing the reference date (starting Monday).
 */
export function getWeekBoundaries(referenceDate: Date = new Date()): {
  startOfWeek: string;
  endOfWeek: string;
  days: Date[];
} {
  const d = new Date(referenceDate);
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    startOfWeek: monday.toISOString(),
    endOfWeek: sunday.toISOString(),
    days,
  };
}

/**
 * Returns the month boundaries containing the reference date.
 */
export function getMonthBoundaries(referenceDate: Date = new Date()): {
  startOfMonth: string;
  endOfMonth: string;
} {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startOfMonth: start.toISOString(),
    endOfMonth: end.toISOString(),
  };
}

/**
 * Validates a task schedule. Start must be strictly before end.
 */
export function validateTaskSchedule(
  startIso: string,
  endIso: string
): { isValid: boolean; error?: string } {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    return { isValid: false, error: 'Invalid date or time format' };
  }

  if (endMs <= startMs) {
    return { isValid: false, error: 'End time must be after start time' };
  }

  const durationMinutes = (endMs - startMs) / (1000 * 60);
  if (durationMinutes < 1) {
    return { isValid: false, error: 'Task duration must be at least 1 minute' };
  }

  if (durationMinutes > 24 * 60) {
    return { isValid: false, error: 'Task cannot exceed 24 hours in duration' };
  }

  return { isValid: true };
}
