/**
 * Phase 3.6 — time-blindness helper. Turns an absolute deadline into a short
 * relative phrase ("in 2h", "overdue 1h", "in 3d") so ND users get a felt sense
 * of how close a thing is without doing clock math. Pure; caller supplies `now`
 * (a single shared 60s ticker drives all chips — never one timer per row).
 */

export interface TimeUntil {
  label: string;
  overdue: boolean;
  /** True when the deadline is within the urgency window (default 6h out or overdue). */
  urgent: boolean;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatTimeUntil(deadline: number, now: number = Date.now()): TimeUntil {
  const diff = deadline - now;
  const overdue = diff < 0;
  const abs = Math.abs(diff);

  let rel: string;
  if (abs < MIN) {
    rel = overdue ? 'just now' : 'now';
  } else if (abs < HOUR) {
    rel = `${Math.round(abs / MIN)}m`;
  } else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs % HOUR) / MIN);
    rel = m > 0 && h < 6 ? `${h}h ${m}m` : `${h}h`;
  } else {
    rel = `${Math.round(abs / DAY)}d`;
  }

  return {
    label: overdue ? `overdue ${rel}` : `in ${rel}`,
    overdue,
    urgent: overdue || diff <= 6 * HOUR,
  };
}
