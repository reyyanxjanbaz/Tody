import { describe, expect, it } from 'vitest';
import {
  calculateActualMinutes, formatMinutes, isUnreasonableDuration, isTooShort, getElapsedMinutes,
} from '../../src/core/utils/timeTracking';

describe('Phase 1.9 — timeTracking', () => {
  it('calculateActualMinutes converts a ms diff into rounded minutes', () => {
    expect(calculateActualMinutes(1000, 91_000)).toBe(2); // 1.5min rounds to 2
    expect(calculateActualMinutes(1000, 61_000)).toBe(1);
  });

  it('calculateActualMinutes returns null for missing/falsy timestamps or negative durations', () => {
    expect(calculateActualMinutes(null, 1000)).toBeNull();
    expect(calculateActualMinutes(1000, null)).toBeNull();
    expect(calculateActualMinutes(0, 1000)).toBeNull(); // startedAt: 0 is falsy, same as missing
    expect(calculateActualMinutes(2000, 1000)).toBeNull();
  });

  it('formatMinutes: sub-minute, minutes-only, and hour+minute forms', () => {
    expect(formatMinutes(0.5)).toBe('<1m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(120)).toBe('2h');
  });

  it('isUnreasonableDuration flags anything over 8 hours', () => {
    expect(isUnreasonableDuration(480)).toBe(false);
    expect(isUnreasonableDuration(481)).toBe(true);
  });

  it('isTooShort flags anything under 1 minute', () => {
    expect(isTooShort(0.9)).toBe(true);
    expect(isTooShort(1)).toBe(false);
  });

  it('getElapsedMinutes measures time since a start timestamp', () => {
    const startedAt = Date.now() - 5 * 60_000;
    expect(getElapsedMinutes(startedAt)).toBe(5);
  });
});
