import { DEFAULT_PREFERENCES, Task, UserPreferences } from '../types';
import { addDays, daysFromNow, endOfDay, startOfDay } from './dateUtils';

export type WeekStart = UserPreferences['weekStartsOn'];
export type TimeFormat = UserPreferences['timeFormat'];

export interface DayboardTimelineItem {
  task: Task;
  startAt: number;
  endAt: number;
  kind: 'scheduled' | 'deadline';
}

export interface DayboardData {
  committed: DayboardTimelineItem[];
  dueToday: Task[];
  flexible: Task[];
  renegotiation: Task[];
  topSuggestions: Task[];
  committedMinutes: number;
  flexibleMinutes: number;
  statusText: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE_MINUTES = 30;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getCategoryId(task: Task): string {
  return task.category ?? 'personal';
}

function matchesCategory(task: Task, categoryId: string): boolean {
  if (categoryId === 'overview') return true;
  return getCategoryId(task) === categoryId;
}

export function isEndOfDayTimestamp(timestamp: number | null | undefined): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return date.getHours() === 23 && date.getMinutes() === 59;
}

export function getTaskDurationMinutes(task: Task): number {
  if (
    task.scheduledStartAt != null &&
    task.scheduledEndAt != null &&
    task.scheduledEndAt > task.scheduledStartAt
  ) {
    return Math.max(15, Math.round((task.scheduledEndAt - task.scheduledStartAt) / 60000));
  }

  return task.estimatedMinutes ?? DEFAULT_SCHEDULE_MINUTES;
}

export function formatCalendarTime(timestamp: number, timeFormat: TimeFormat): string {
  const date = new Date(timestamp);
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (timeFormat === '24h') {
    return `${date.getHours().toString().padStart(2, '0')}:${minutes}`;
  }

  const rawHour = date.getHours();
  const suffix = rawHour >= 12 ? 'pm' : 'am';
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return minutes === '00' ? `${hour12}${suffix}` : `${hour12}:${minutes}${suffix}`;
}

export function formatDayTitle(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function formatDaySubtitle(timestamp: number): string {
  const date = new Date(timestamp);
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getFullYear()}`;
}

export function getWeekStartDate(timestamp: number, weekStartsOn: WeekStart): Date {
  const anchor = startOfDay(new Date(timestamp));
  const currentDow = anchor.getDay();
  const targetDow = weekStartsOn === 'monday' ? 1 : 0;
  const offset = (currentDow - targetDow + 7) % 7;
  return addDays(anchor, -offset);
}

export function getWeekDays(timestamp: number, weekStartsOn: WeekStart): Date[] {
  const weekStart = getWeekStartDate(timestamp, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function getMonthGrid(
  year: number,
  month: number,
  weekStartsOn: WeekStart,
): Array<Date | null> {
  const firstDay = new Date(year, month, 1);
  const firstDow = firstDay.getDay();
  const weekOffset = weekStartsOn === 'monday'
    ? (firstDow + 6) % 7
    : firstDow;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = Array(weekOffset).fill(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function computeFlexibleScore(task: Task): number {
  let score = 0;

  if (task.deadline) {
    const days = daysFromNow(task.deadline);
    if (days < 0) {
      score += 100;
    } else if (days === 0) {
      score += 80;
    } else if (days <= 3) {
      score += 50 - days * 8;
    } else {
      score += Math.max(0, 20 - days);
    }
  }

  score += ({ high: 28, medium: 18, low: 10, none: 4 } as const)[task.priority];
  score += ({ high: 8, medium: 5, low: 3 } as const)[task.energyLevel];
  score += Math.max(0, 12 - Math.min(task.estimatedMinutes ?? DEFAULT_SCHEDULE_MINUTES, 120) / 10);
  score += Math.min(12, (Date.now() - task.createdAt) / DAY_MS);
  score -= Math.min(10, task.deferCount * 2);

  return score;
}

export function getDayboardData(
  tasks: Task[],
  selectedDate: number,
  categoryId: string,
): DayboardData {
  const dayStart = startOfDay(new Date(selectedDate)).getTime();
  const dayEnd = endOfDay(new Date(selectedDate)).getTime();
  const todayStart = startOfDay().getTime();

  const active = tasks.filter(task =>
    !task.isCompleted &&
    !task.isArchived &&
    matchesCategory(task, categoryId),
  );

  const renegotiation = dayStart === todayStart
    ? active
      .filter(task => task.deadline != null && daysFromNow(task.deadline) < 0)
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))
    : [];
  const renegotiationIds = new Set(renegotiation.map(task => task.id));

  const committed: DayboardTimelineItem[] = active
    .filter(task => !renegotiationIds.has(task.id))
    .reduce<DayboardTimelineItem[]>((items, task) => {
      if (
        task.scheduledStartAt != null &&
        task.scheduledEndAt != null &&
        task.scheduledEndAt > task.scheduledStartAt &&
        task.scheduledStartAt >= dayStart &&
        task.scheduledStartAt <= dayEnd
      ) {
        items.push({
          task,
          startAt: task.scheduledStartAt,
          endAt: task.scheduledEndAt,
          kind: 'scheduled',
        });
        return items;
      }

      if (
        task.deadline != null &&
        task.deadline >= dayStart &&
        task.deadline <= dayEnd &&
        !isEndOfDayTimestamp(task.deadline)
      ) {
        const duration = getTaskDurationMinutes(task);
        items.push({
          task,
          startAt: task.deadline,
          endAt: task.deadline + duration * 60000,
          kind: 'deadline',
        });
      }

      return items;
    }, [])
    .sort((a, b) => a.startAt - b.startAt);

  const committedIds = new Set(committed.map(item => item.task.id));

  const dueToday = active
    .filter(task =>
      !renegotiationIds.has(task.id) &&
      !committedIds.has(task.id) &&
      task.deadline != null &&
      task.deadline >= dayStart &&
      task.deadline <= dayEnd,
    )
    .sort((a, b) => {
      const priorityWeight = ({ high: 0, medium: 1, low: 2, none: 3 } as const);
      const priorityDelta = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return (a.deadline ?? Number.MAX_SAFE_INTEGER) - (b.deadline ?? Number.MAX_SAFE_INTEGER);
    });

  const dueTodayIds = new Set(dueToday.map(task => task.id));

  const flexible = active
    .filter(task =>
      !renegotiationIds.has(task.id) &&
      !committedIds.has(task.id) &&
      !dueTodayIds.has(task.id),
    )
    .sort((a, b) => {
      const scoreDelta = computeFlexibleScore(b) - computeFlexibleScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return a.createdAt - b.createdAt;
    });

  const committedMinutes = committed.reduce((sum, item) => (
    sum + Math.max(15, Math.round((item.endAt - item.startAt) / 60000))
  ), 0);
  const flexibleMinutes = flexible.reduce((sum, task) => sum + getTaskDurationMinutes(task), 0);
  const topSuggestions = flexible.slice(0, 3);

  let statusText = 'Light day. Room to focus.';
  if (committed.length > 0 || flexibleMinutes > 0) {
    const commitmentText = `${committed.length} commitment${committed.length === 1 ? '' : 's'}`;
    const flexibilityText = `${flexibleMinutes} min still movable`;
    statusText = `${commitmentText}, ${flexibilityText}.`;
  }
  if (renegotiation.length > 0) {
    statusText += ` ${renegotiation.length} item${renegotiation.length === 1 ? '' : 's'} need a gentle reset.`;
  }

  return {
    committed,
    dueToday,
    flexible,
    renegotiation,
    topSuggestions,
    committedMinutes,
    flexibleMinutes,
    statusText,
  };
}

export function getInitialPreferences(
  prefs: UserPreferences | null | undefined,
): UserPreferences {
  return { ...DEFAULT_PREFERENCES, ...(prefs ?? {}) };
}
