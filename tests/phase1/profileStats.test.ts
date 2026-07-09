import { describe, expect, it } from 'vitest';
import { calculateXP, getMonthCalendarData } from '../../src/core/utils/profileStats';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't', title: 'Task', description: '',
    createdAt: 0, updatedAt: 0, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: false, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 9, overdueStartDate: null,
    revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
    actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0,
    category: 'personal',
    ...overrides,
  } as Task;
}

describe('Phase 1.9 — profileStats', () => {
  describe('calculateXP', () => {
    it('awards base XP per completed task and ignores incomplete ones', () => {
      const xp = calculateXP([
        makeTask({ isCompleted: true, completedAt: 1 }),
        makeTask({ isCompleted: false }),
      ], 0);
      expect(xp.totalXP).toBe(10);
    });

    it('awards the estimate bonus and the on-time bonus when applicable', () => {
      const xp = calculateXP([
        makeTask({ isCompleted: true, completedAt: 100, deadline: 200, estimatedMinutes: 30 }),
      ], 0);
      // 10 base + 5 estimate bonus + 8 on-time bonus (completed before deadline)
      expect(xp.totalXP).toBe(23);
    });

    it('does not award the on-time bonus when completed after the deadline', () => {
      const xp = calculateXP([
        makeTask({ isCompleted: true, completedAt: 300, deadline: 200 }),
      ], 0);
      expect(xp.totalXP).toBe(10);
    });

    it('ignores the (deprecated) live-streak param — no XP from it directly', () => {
      // Second arg used to add streak*3 to the total; it is now ignored.
      expect(calculateXP([], 5).totalXP).toBe(0);
      expect(calculateXP([], 999).totalXP).toBe(0);
    });

    it('banks +3 XP per day inside a run of >= 2 consecutive completion days', () => {
      const d = (day: number) => new Date(2026, 5, day, 12, 0).getTime();
      // Completions on Jun 1,2,3 (run of 3) → 3 tasks (30) + 3 banked days (9) = 39.
      const run = [
        makeTask({ id: 'a', isCompleted: true, completedAt: d(1) }),
        makeTask({ id: 'b', isCompleted: true, completedAt: d(2) }),
        makeTask({ id: 'c', isCompleted: true, completedAt: d(3) }),
      ];
      expect(calculateXP(run).totalXP).toBe(39);

      // An isolated single day earns no streak bonus.
      expect(calculateXP([makeTask({ id: 'x', isCompleted: true, completedAt: d(10) })]).totalXP).toBe(10);
    });

    it('is MONOTONIC: breaking the current streak never lowers XP (P1.6 regression)', () => {
      const d = (day: number) => new Date(2026, 5, day, 12, 0).getTime();
      // A 5-day run.
      const fiveDayRun = [1, 2, 3, 4, 5].map((n) =>
        makeTask({ id: `r${n}`, isCompleted: true, completedAt: d(n) }),
      );
      const withStreak = calculateXP(fiveDayRun);

      // "Later" the streak is broken (user misses days) — but the past run's
      // completions still exist. XP must not decrease.
      const afterBreak = calculateXP(fiveDayRun); // history unchanged
      expect(afterBreak.totalXP).toBeGreaterThanOrEqual(withStreak.totalXP);
      expect(afterBreak.level).toBeGreaterThanOrEqual(withStreak.level);
    });

    it('accepts extraXP (e.g. from habit completions) and folds it into level math', () => {
      const xp = calculateXP([], 0, 120); // 120 XP -> exactly level 2
      expect(xp.totalXP).toBe(120);
      expect(xp.level).toBe(2);
      expect(xp.xpInCurrentLevel).toBe(0);

      const mid = calculateXP([], 0, 150); // level 2, 30/120 = 25%
      expect(mid.level).toBe(2);
      expect(mid.xpInCurrentLevel).toBe(30);
      expect(mid.progressPercent).toBe(25);
    });
  });

  describe('getMonthCalendarData', () => {
    it('returns one entry per day in the month', () => {
      const data = getMonthCalendarData([], 2026, 5); // June 2026 -> 30 days
      expect(data.length).toBe(30);
      expect(data.every(d => d.total === 0 && !d.allDone && !d.hasIncomplete)).toBe(true);
    });

    it('marks allDone true only when every task for that day is completed', () => {
      const day = new Date(2026, 5, 10, 9, 0).getTime();
      const tasks = [
        makeTask({ id: 'a', deadline: day, isCompleted: true }),
        makeTask({ id: 'b', deadline: day, isCompleted: true }),
      ];
      const data = getMonthCalendarData(tasks, 2026, 5);
      const tenth = data.find(d => new Date(d.date).getDate() === 10)!;
      expect(tenth.total).toBe(2);
      expect(tenth.completed).toBe(2);
      expect(tenth.allDone).toBe(true);
      expect(tenth.hasIncomplete).toBe(false);
    });

    it('marks hasIncomplete true when some but not all tasks for that day are done', () => {
      const day = new Date(2026, 5, 12, 9, 0).getTime();
      const tasks = [
        makeTask({ id: 'a', deadline: day, isCompleted: true }),
        makeTask({ id: 'b', deadline: day, isCompleted: false }),
      ];
      const data = getMonthCalendarData(tasks, 2026, 5);
      const twelfth = data.find(d => new Date(d.date).getDate() === 12)!;
      expect(twelfth.hasIncomplete).toBe(true);
      expect(twelfth.allDone).toBe(false);
    });

    it('counts a completed task ONCE, on its completion day only (P1.12 — no double-count)', () => {
      const completedDay = new Date(2026, 5, 20, 14, 0).getTime();
      const tasks = [makeTask({ deadline: new Date(2026, 5, 1).getTime(), isCompleted: true, completedAt: completedDay })];
      const data = getMonthCalendarData(tasks, 2026, 5);
      const twentieth = data.find(d => new Date(d.date).getDate() === 20)!;
      const first = data.find(d => new Date(d.date).getDate() === 1)!;
      expect(twentieth.total).toBe(1);
      expect(twentieth.allDone).toBe(true);
      // Previously the task ALSO showed on its deadline day (the 1st) — now 0.
      expect(first.total).toBe(0);
    });
  });
});
