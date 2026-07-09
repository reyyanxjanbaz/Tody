import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startOfDay, endOfDay, isTimestampOnDay, addDays,
  isToday, isTomorrow, isPast, daysFromNow, getNextDay,
  formatRelativeDate, formatTime, formatDeadline, formatCompletedDate,
} from '../../src/core/utils/dateUtils';

describe('Phase 1.9 — dateUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 10, 30, 0, 0)); // Mon Jun 15 2026, 10:30
  });
  afterEach(() => vi.useRealTimers());

  it('startOfDay/endOfDay zero out or max out the time component', () => {
    const d = new Date(2026, 5, 15, 14, 22, 1);
    expect(startOfDay(d).getHours()).toBe(0);
    expect(endOfDay(d).getHours()).toBe(23);
    expect(endOfDay(d).getMinutes()).toBe(59);
  });

  it('isTimestampOnDay checks membership in a calendar day', () => {
    const dayStart = new Date(2026, 5, 15).getTime();
    expect(isTimestampOnDay(new Date(2026, 5, 15, 8).getTime(), dayStart)).toBe(true);
    expect(isTimestampOnDay(new Date(2026, 5, 16, 0, 1).getTime(), dayStart)).toBe(false);
    expect(isTimestampOnDay(null, dayStart)).toBe(false);
  });

  it('addDays shifts the calendar date', () => {
    expect(addDays(new Date(2026, 5, 15), 3).getDate()).toBe(18);
  });

  it('isToday/isTomorrow/isPast classify a timestamp relative to now', () => {
    expect(isToday(Date.now())).toBe(true);
    expect(isTomorrow(addDays(new Date(), 1).getTime())).toBe(true);
    expect(isPast(new Date(2020, 0, 1).getTime())).toBe(true);
    expect(isPast(addDays(new Date(), 1).getTime())).toBe(false);
  });

  it('daysFromNow computes whole-day distance regardless of time-of-day', () => {
    expect(daysFromNow(Date.now())).toBe(0);
    expect(daysFromNow(new Date(2026, 5, 18, 23, 59).getTime())).toBe(3);
    expect(daysFromNow(new Date(2026, 5, 13, 0, 1).getTime())).toBe(-2);
    expect(daysFromNow(0)).toBe(0);
  });

  it('getNextDay resolves the next occurrence of a weekday (today is Monday)', () => {
    const nextFriday = getNextDay(5); // Friday
    expect(nextFriday.getDay()).toBe(5);
    expect(nextFriday.getDate()).toBe(19);

    // Requesting today's own weekday rolls to next week, not "today".
    const nextMonday = getNextDay(1);
    expect(nextMonday.getDate()).toBe(22);
  });

  it('formatRelativeDate: Today/Tomorrow/Yesterday/day-name/weeks/date fallback', () => {
    expect(formatRelativeDate(Date.now())).toBe('Today');
    expect(formatRelativeDate(addDays(new Date(), 1).getTime())).toBe('Tomorrow');
    expect(formatRelativeDate(addDays(new Date(), -1).getTime())).toBe('Yesterday');
    expect(formatRelativeDate(addDays(new Date(), 3).getTime())).toBe('Thu');
    expect(formatRelativeDate(addDays(new Date(), 14).getTime())).toBe('2w');
    expect(formatRelativeDate(addDays(new Date(), -14).getTime())).toBe('2w ago');
  });

  it('formatTime renders 12-hour clock with am/pm, omitting :00 minutes', () => {
    expect(formatTime(new Date(2026, 5, 15, 0, 0).getTime())).toBe('12am');
    expect(formatTime(new Date(2026, 5, 15, 13, 5).getTime())).toBe('1:05pm');
    expect(formatTime(new Date(2026, 5, 15, 23, 0).getTime())).toBe('11pm');
  });

  it('formatDeadline hides the clock time for exact end-of-day (23:59) deadlines', () => {
    const eod = endOfDay(new Date()).getTime();
    expect(formatDeadline(eod)).toBe('Today');
    const withTime = new Date(2026, 5, 15, 15, 0).getTime();
    expect(formatDeadline(withTime)).toBe('Today 3pm');
  });

  it('formatCompletedDate: Done <time> today, Done yesterday, or Done <date>', () => {
    expect(formatCompletedDate(Date.now())).toMatch(/^Done \d{1,2}:?\d*(am|pm)$/);
    expect(formatCompletedDate(addDays(new Date(), -1).getTime())).toBe('Done yesterday');
    expect(formatCompletedDate(addDays(new Date(), -10).getTime())).toMatch(/^Done \d{1,2} \w{3}$/);
    expect(formatCompletedDate(0)).toBe('Done');
  });
});
