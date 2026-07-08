import { describe, expect, it } from 'vitest';
import { calculateXP } from '../../src/core/utils/profileStats';
import type { Task } from '../../src/core/types';

/**
 * Phase C — XP constant parity fixture.
 *
 * The weekly leaderboard is computed server-side (server/routers/social.py) using
 * the SAME per-task XP values as the client's calculateXP: 10 base, +5 for an
 * estimate, +8 for on-time. This fixture pins those values so a change on either
 * side is caught (update social.py's XP_* constants in lockstep with this test).
 */
function completed(overrides: Partial<Task>): Task {
  const base = Date.UTC(2026, 0, 5, 12, 0, 0); // fixed instant
  return {
    id: Math.random().toString(36).slice(2), title: 't', description: '',
    createdAt: base - 3_600_000, updatedAt: base, deadline: null, completedAt: base,
    priority: 'none', energyLevel: 'medium', isCompleted: true, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 0, childIds: [], depth: 0,
    ...overrides,
  };
}

describe('Phase C — XP constants (client ⇄ server leaderboard)', () => {
  it('a plain completed task is worth 10 XP', () => {
    expect(calculateXP([completed({})]).totalXP).toBe(10);
  });

  it('a time estimate adds 5 XP', () => {
    expect(calculateXP([completed({ estimatedMinutes: 30 })]).totalXP).toBe(15);
  });

  it('finishing on or before the deadline adds 8 XP', () => {
    const t = completed({});
    expect(calculateXP([{ ...t, deadline: t.completedAt! + 1000 }]).totalXP).toBe(18);
  });

  it('estimate + on-time stack to 23 XP', () => {
    const t = completed({ estimatedMinutes: 30 });
    expect(calculateXP([{ ...t, deadline: t.completedAt! }]).totalXP).toBe(23);
  });

  it('120 XP is one level; progress wraps within a level', () => {
    const data = calculateXP(Array.from({ length: 12 }, () => completed({})));
    // 12 * 10 = 120 XP → exactly level 2, 0% into it.
    expect(data.totalXP).toBe(120);
    expect(data.level).toBe(2);
    expect(data.progressPercent).toBe(0);
  });
});
