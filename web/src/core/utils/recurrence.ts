import type { RecurringFrequency } from '../types';

/**
 * Recurring-task deadline math (Phase 3.1). Pure, local-time, DST-safe.
 *
 * The `deadline` fields carry a real clock time (including the 23:59 EOD
 * sentinel meaning "date-only"). We advance the CALENDAR fields via
 * Date.setDate/setMonth so the wall-clock time — hours/minutes/seconds — is
 * preserved across DST boundaries, unlike naive `ts + N*86400000` arithmetic.
 */

/** Advance a deadline by exactly one period. Month-end is clamped (Jan 31 → Feb 28). */
export function getNextOccurrence(deadline: number, frequency: RecurringFrequency): number {
  const d = new Date(deadline);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly': {
      const day = d.getDate();
      // Pin to the 1st before rolling the month so we never overflow (e.g. Jan 31
      // + 1 month must not silently become Mar 3), then clamp to the new month's length.
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, daysInMonth));
      break;
    }
  }
  return d.getTime();
}

/**
 * Advance a deadline forward until it is strictly after `after`, so a recurring
 * task that was overdue spawns its NEXT genuinely-future instance rather than
 * one still in the past. Capped so a long-neglected daily task can't spin.
 */
export function getNextOccurrenceAfter(
  deadline: number,
  frequency: RecurringFrequency,
  after: number,
): number {
  let next = getNextOccurrence(deadline, frequency);
  let guard = 0;
  while (next <= after && guard < 1000) {
    next = getNextOccurrence(next, frequency);
    guard++;
  }
  return next;
}

export const RECURRENCE_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

/** Short pill label, e.g. for a TaskItem chip. */
export const RECURRENCE_SHORT: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

export const RECURRENCE_OPTIONS: RecurringFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];
