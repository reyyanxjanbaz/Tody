/**
 * Snooze/defer target computation — all in LOCAL time (the client is the
 * source of truth for local-day semantics; the backend must not recompute
 * these in UTC).
 *
 * Note on the 23:59 sentinel: a deadline set to 23:59 local is treated
 * app-wide as "date only, no specific time" (see dateUtils.formatDeadline).
 * The date-granularity snooze options deliberately use it so a deferred task
 * shows as a day, not a late-night time.
 */

export type SnoozeOption =
  | 'later-today'   // +3h, clamped to before 23:59 today
  | 'tonight'       // today 21:00 (or +1h if already past 21:00)
  | 'tomorrow'      // tomorrow 23:59
  | 'weekend'       // upcoming Saturday 23:59
  | 'next-week';    // upcoming Monday 23:59

function atEndOfDay(d: Date): number {
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Days until the next given weekday (0=Sun..6=Sat); today counts as "next week" (7). */
function daysUntilWeekday(from: Date, weekday: number): number {
  const diff = (weekday - from.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}

export function computeSnoozeTarget(option: SnoozeOption, now: Date = new Date()): number {
  const base = new Date(now);

  switch (option) {
    case 'later-today': {
      const t = new Date(base.getTime() + 3 * 60 * 60 * 1000);
      const eod = new Date(base);
      eod.setHours(23, 59, 0, 0);
      return Math.min(t.getTime(), eod.getTime());
    }
    case 'tonight': {
      const nine = new Date(base);
      nine.setHours(21, 0, 0, 0);
      if (nine.getTime() <= base.getTime()) {
        return base.getTime() + 60 * 60 * 1000; // already past 9pm → +1h
      }
      return nine.getTime();
    }
    case 'tomorrow': {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      return atEndOfDay(d);
    }
    case 'weekend': {
      const d = new Date(base);
      d.setDate(d.getDate() + daysUntilWeekday(base, 6)); // Saturday
      return atEndOfDay(d);
    }
    case 'next-week': {
      const d = new Date(base);
      d.setDate(d.getDate() + daysUntilWeekday(base, 1)); // Monday
      return atEndOfDay(d);
    }
  }
}

export const SNOOZE_LABELS: Record<SnoozeOption, string> = {
  'later-today': 'Later today',
  'tonight': 'Tonight',
  'tomorrow': 'Tomorrow',
  'weekend': 'This weekend',
  'next-week': 'Next week',
};
