import { describe, expect, it } from 'vitest';
import { getNextOccurrence, getNextOccurrenceAfter } from '../../src/core/utils/recurrence';

// Local-time construction so assertions match the calendar math the util uses.
const at = (y: number, m: number, d: number, h = 23, min = 59) => new Date(y, m - 1, d, h, min).getTime();
const parts = (ts: number) => { const dt = new Date(ts); return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), h: dt.getHours(), min: dt.getMinutes() }; };

describe('Phase 3.1 — recurrence', () => {
  it('daily advances by one calendar day, preserving time', () => {
    const p = parts(getNextOccurrence(at(2026, 3, 10, 9, 30), 'daily'));
    expect(p).toMatchObject({ y: 2026, m: 3, d: 11, h: 9, min: 30 });
  });

  it('weekly advances by 7 days', () => {
    const p = parts(getNextOccurrence(at(2026, 3, 10), 'weekly'));
    expect(p).toMatchObject({ m: 3, d: 17 });
  });

  it('biweekly advances by 14 days', () => {
    const p = parts(getNextOccurrence(at(2026, 3, 10), 'biweekly'));
    expect(p).toMatchObject({ m: 3, d: 24 });
  });

  it('monthly advances by one month keeping the day-of-month', () => {
    const p = parts(getNextOccurrence(at(2026, 3, 15), 'monthly'));
    expect(p).toMatchObject({ m: 4, d: 15 });
  });

  it('monthly clamps to the last day when the target month is shorter (Jan 31 -> Feb 28)', () => {
    const p = parts(getNextOccurrence(at(2026, 1, 31), 'monthly'));
    expect(p).toMatchObject({ m: 2, d: 28 });
  });

  it('monthly clamps across a leap February (Jan 31 2028 -> Feb 29)', () => {
    const p = parts(getNextOccurrence(at(2028, 1, 31), 'monthly'));
    expect(p).toMatchObject({ m: 2, d: 29 });
  });

  it('preserves the 23:59 end-of-day sentinel', () => {
    const p = parts(getNextOccurrence(at(2026, 3, 10, 23, 59), 'daily'));
    expect(p).toMatchObject({ h: 23, min: 59 });
  });

  it('rolls forward past an overdue deadline to a genuinely-future instance', () => {
    const deadline = at(2026, 3, 1, 12, 0);
    const now = at(2026, 3, 5, 8, 0);
    const next = getNextOccurrenceAfter(deadline, 'daily', now);
    expect(next).toBeGreaterThan(now);
    // Rolling the Mar 1 12:00 series forward, the first instance strictly after
    // Mar 5 08:00 is Mar 5 12:00 (that day's noon is still ahead of 08:00).
    expect(parts(next)).toMatchObject({ m: 3, d: 5, h: 12 });
  });

  it('getNextOccurrenceAfter returns the immediate next when already future', () => {
    const deadline = at(2026, 3, 10, 12, 0);
    const now = at(2026, 3, 9, 8, 0);
    expect(parts(getNextOccurrenceAfter(deadline, 'weekly', now))).toMatchObject({ m: 3, d: 17 });
  });
});
