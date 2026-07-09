import { describe, expect, it } from 'vitest';
import { formatTimeUntil } from '../../src/utils/timeUntil';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

describe('Phase 3.6 — formatTimeUntil', () => {
  it('labels a near-future deadline in minutes and marks it urgent', () => {
    const r = formatTimeUntil(NOW + 20 * MIN, NOW);
    expect(r.label).toBe('in 20m');
    expect(r.overdue).toBe(false);
    expect(r.urgent).toBe(true);
  });

  it('labels a few hours out in hours', () => {
    const r = formatTimeUntil(NOW + 3 * HOUR, NOW);
    expect(r.label).toBe('in 3h');
    expect(r.urgent).toBe(true);
  });

  it('shows h+m granularity only inside the urgency window', () => {
    expect(formatTimeUntil(NOW + 2 * HOUR + 15 * MIN, NOW).label).toBe('in 2h 15m');
    // Beyond 6h we drop the minutes to reduce noise.
    expect(formatTimeUntil(NOW + 8 * HOUR + 15 * MIN, NOW).label).toBe('in 8h');
  });

  it('a deadline further than 6h out is not urgent', () => {
    expect(formatTimeUntil(NOW + 10 * HOUR, NOW).urgent).toBe(false);
  });

  it('labels multi-day distances in days', () => {
    expect(formatTimeUntil(NOW + 3 * DAY, NOW).label).toBe('in 3d');
  });

  it('marks overdue deadlines and always treats them as urgent', () => {
    const r = formatTimeUntil(NOW - 90 * MIN, NOW);
    expect(r.overdue).toBe(true);
    expect(r.urgent).toBe(true);
    expect(r.label).toBe('overdue 1h 30m');
  });
});
