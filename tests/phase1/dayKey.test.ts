import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  toDayKey, todayKey, fromDayKey, daysBetweenKeys, dayKeysBetween, addDaysToKey,
} from '../../src/core/utils/dayKey';

describe('Phase 1.1 — dayKey (local-time day boundaries)', () => {
  afterEach(() => vi.useRealTimers());

  it('toDayKey formats local calendar date as YYYY-MM-DD', () => {
    expect(toDayKey(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('toDayKey uses the LOCAL date, not UTC — 11pm stays on its own day', () => {
    // 2026-03-10 23:00 local is still "the 10th" regardless of UTC offset.
    const late = new Date(2026, 2, 10, 23, 0, 0);
    expect(toDayKey(late)).toBe('2026-03-10');
  });

  it('todayKey matches a mocked system date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4, 8, 0, 0));
    expect(todayKey()).toBe('2026-07-04');
  });

  it('fromDayKey round-trips to local midnight', () => {
    const d = fromDayKey('2026-07-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(0);
    expect(toDayKey(d)).toBe('2026-07-04');
  });

  it('daysBetweenKeys computes whole-day distance', () => {
    expect(daysBetweenKeys('2026-07-04', '2026-07-04')).toBe(0);
    expect(daysBetweenKeys('2026-07-04', '2026-07-07')).toBe(3);
    expect(daysBetweenKeys('2026-07-07', '2026-07-04')).toBe(-3);
  });

  it('daysBetweenKeys stays integer across a spring-forward DST boundary', () => {
    // US DST 2026 spring-forward is Mar 8 (a 23-hour local day). The key
    // distance must still be exactly 1, not 0.96.
    expect(daysBetweenKeys('2026-03-08', '2026-03-09')).toBe(1);
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('dayKeysBetween lists an inclusive ascending range', () => {
    expect(dayKeysBetween('2026-07-04', '2026-07-07')).toEqual([
      '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07',
    ]);
  });

  it('dayKeysBetween spans a month boundary correctly', () => {
    expect(dayKeysBetween('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02',
    ]);
  });

  it('dayKeysBetween is empty when the end precedes the start', () => {
    expect(dayKeysBetween('2026-07-07', '2026-07-04')).toEqual([]);
  });

  it('addDaysToKey shifts forward and backward, crossing month/year ends', () => {
    expect(addDaysToKey('2026-07-04', 3)).toBe('2026-07-07');
    expect(addDaysToKey('2026-07-04', -4)).toBe('2026-06-30');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});
