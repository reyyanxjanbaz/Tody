import { describe, expect, it } from 'vitest';
import { computeSnoozeTarget, SNOOZE_LABELS } from '../../src/core/utils/snooze';

// Fixed reference: Wed 2026-07-08, 14:00 local.
const NOW = new Date(2026, 6, 8, 14, 0, 0, 0);

describe('Phase 1.4 — snooze targets (all local time)', () => {
  it('later-today = +3h', () => {
    const t = new Date(computeSnoozeTarget('later-today', NOW));
    expect(t.getHours()).toBe(17);
    expect(t.getDate()).toBe(8);
  });

  it('later-today clamps to 23:59 when +3h would spill past midnight', () => {
    const late = new Date(2026, 6, 8, 22, 30, 0, 0);
    const t = new Date(computeSnoozeTarget('later-today', late));
    expect(t.getDate()).toBe(8);
    expect(t.getHours()).toBe(23);
    expect(t.getMinutes()).toBe(59);
  });

  it('tonight = today 21:00', () => {
    const t = new Date(computeSnoozeTarget('tonight', NOW));
    expect(t.getDate()).toBe(8);
    expect(t.getHours()).toBe(21);
    expect(t.getMinutes()).toBe(0);
  });

  it('tonight past 9pm falls back to +1h', () => {
    const late = new Date(2026, 6, 8, 22, 0, 0, 0);
    const t = new Date(computeSnoozeTarget('tonight', late));
    expect(t.getHours()).toBe(23);
  });

  it('tomorrow = tomorrow 23:59', () => {
    const t = new Date(computeSnoozeTarget('tomorrow', NOW));
    expect(t.getDate()).toBe(9);
    expect(t.getHours()).toBe(23);
    expect(t.getMinutes()).toBe(59);
  });

  it('weekend = upcoming Saturday 23:59 (Wed → +3 days)', () => {
    const t = new Date(computeSnoozeTarget('weekend', NOW));
    expect(t.getDay()).toBe(6); // Saturday
    expect(t.getDate()).toBe(11);
  });

  it('weekend on a Saturday rolls to next Saturday, not today', () => {
    const sat = new Date(2026, 6, 11, 10, 0, 0, 0); // Sat
    const t = new Date(computeSnoozeTarget('weekend', sat));
    expect(t.getDay()).toBe(6);
    expect(t.getDate()).toBe(18);
  });

  it('next-week = upcoming Monday 23:59', () => {
    const t = new Date(computeSnoozeTarget('next-week', NOW));
    expect(t.getDay()).toBe(1); // Monday
    expect(t.getDate()).toBe(13);
  });

  it('exposes a label for every option', () => {
    for (const opt of ['later-today', 'tonight', 'tomorrow', 'weekend', 'next-week'] as const) {
      expect(SNOOZE_LABELS[opt]).toBeTruthy();
    }
  });
});
