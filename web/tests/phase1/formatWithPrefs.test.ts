import { describe, expect, it } from 'vitest';
import { formatDate, formatClock } from '../../src/utils/formatWithPrefs';

const D = new Date(2026, 0, 5, 15, 5).getTime(); // Jan 5 2026, 3:05pm local

describe('Phase 1.2 — formatWithPrefs', () => {
  it('formatDate honors each dateFormat', () => {
    expect(formatDate(D, { dateFormat: 'MM/DD/YYYY' })).toBe('01/05/2026');
    expect(formatDate(D, { dateFormat: 'DD/MM/YYYY' })).toBe('05/01/2026');
    expect(formatDate(D, { dateFormat: 'YYYY-MM-DD' })).toBe('2026-01-05');
  });

  it('formatDate returns "" for falsy/invalid timestamps', () => {
    expect(formatDate(0, { dateFormat: 'MM/DD/YYYY' })).toBe('');
    expect(formatDate(NaN, { dateFormat: 'MM/DD/YYYY' })).toBe('');
  });

  it('formatClock renders 12h with am/pm and omits :00 minutes', () => {
    expect(formatClock(D, { timeFormat: '12h' })).toBe('3:05pm');
    expect(formatClock(new Date(2026, 0, 5, 9, 0).getTime(), { timeFormat: '12h' })).toBe('9am');
    expect(formatClock(new Date(2026, 0, 5, 0, 0).getTime(), { timeFormat: '12h' })).toBe('12am');
  });

  it('formatClock renders 24h zero-padded', () => {
    expect(formatClock(D, { timeFormat: '24h' })).toBe('15:05');
    expect(formatClock(new Date(2026, 0, 5, 9, 0).getTime(), { timeFormat: '24h' })).toBe('09:00');
    expect(formatClock(new Date(2026, 0, 5, 0, 0).getTime(), { timeFormat: '24h' })).toBe('00:00');
  });
});
