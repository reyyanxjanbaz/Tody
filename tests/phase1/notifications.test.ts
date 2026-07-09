import { describe, expect, it } from 'vitest';
import { isWithinQuietHours, nextClockTime } from '../../src/core/lib/notifications';

describe('Phase 6.1 — quiet hours', () => {
  const at = (h: number, m = 0) => new Date(2026, 2, 16, h, m);

  it('is off when either bound is null', () => {
    expect(isWithinQuietHours({ start: null, end: '07:00' }, at(3))).toBe(false);
    expect(isWithinQuietHours({ start: '22:00', end: null }, at(3))).toBe(false);
  });

  it('handles a same-day window', () => {
    const q = { start: '13:00', end: '14:00' };
    expect(isWithinQuietHours(q, at(13, 30))).toBe(true);
    expect(isWithinQuietHours(q, at(14, 0))).toBe(false); // end is exclusive
    expect(isWithinQuietHours(q, at(12, 59))).toBe(false);
  });

  it('handles a window that wraps past midnight', () => {
    const q = { start: '22:00', end: '07:00' };
    expect(isWithinQuietHours(q, at(23, 0))).toBe(true);
    expect(isWithinQuietHours(q, at(3, 0))).toBe(true);
    expect(isWithinQuietHours(q, at(6, 59))).toBe(true);
    expect(isWithinQuietHours(q, at(7, 0))).toBe(false);
    expect(isWithinQuietHours(q, at(12, 0))).toBe(false);
  });
});

describe('Phase 6.1 — nextClockTime', () => {
  it('returns today when the time is still ahead', () => {
    const from = new Date(2026, 2, 16, 8, 0);
    const t = new Date(nextClockTime('09:30', from));
    expect(t.getDate()).toBe(16);
    expect(t.getHours()).toBe(9);
    expect(t.getMinutes()).toBe(30);
  });

  it('rolls to tomorrow when the time already passed today', () => {
    const from = new Date(2026, 2, 16, 10, 0);
    const t = new Date(nextClockTime('09:30', from));
    expect(t.getDate()).toBe(17);
    expect(t.getHours()).toBe(9);
  });
});
