const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isToday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isTomorrow(timestamp: number): boolean {
  const date = new Date(timestamp);
  const tomorrow = addDays(new Date(), 1);
  return date.toDateString() === tomorrow.toDateString();
}

export function isPast(timestamp: number): boolean {
  return timestamp < startOfDay().getTime();
}

export function daysFromNow(timestamp: number): number {
  const now = startOfDay().getTime();
  const target = startOfDay(new Date(timestamp)).getTime();
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

export function getNextDay(dayOfWeek: number): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) { daysUntil += 7; }
  return addDays(startOfDay(now), daysUntil);
}

export function formatRelativeDate(timestamp: number): string {
  const days = daysFromNow(timestamp);

  if (days < 0) {
    const absDays = Math.abs(days);
    if (absDays === 1) { return 'Yesterday'; }
    if (absDays < 7) { return `${absDays} days ago`; }
    return `${Math.round(absDays / 7)}w ago`;
  }

  if (days === 0) { return 'Today'; }
  if (days === 1) { return 'Tomorrow'; }

  if (days < 7) {
    return DAY_NAMES[new Date(timestamp).getDay()];
  }

  if (days < 30) {
    return `${Math.round(days / 7)}w`;
  }

  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

  if (m === 0) {
    return `${hour12}${period}`;
  }

  return `${hour12}:${m.toString().padStart(2, '0')}${period}`;
}

export function formatDeadline(timestamp: number): string {
  const date = new Date(timestamp);
  const relativeDate = formatRelativeDate(timestamp);

  // If it's set to end-of-day (23:59), don't show time
  if (date.getHours() === 23 && date.getMinutes() === 59) {
    return relativeDate;
  }

  return `${relativeDate} ${formatTime(timestamp)}`;
}

export function formatCompletedDate(timestamp: number): string {
  if (isToday(timestamp)) { return `Done ${formatTime(timestamp)}`; }
  if (daysFromNow(timestamp) === -1) { return 'Done yesterday'; }
  const date = new Date(timestamp);
  return `Done ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}
