import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatOverdueGently, isFullyDecayed, initializeOverdueDates } from '../../src/core/utils/decay';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', description: '',
    createdAt: Date.now(), updatedAt: Date.now(),
    deadline: null, completedAt: null, priority: 'none', energyLevel: 'medium',
    isCompleted: false, isRecurring: false, recurringFrequency: null,
    deferCount: 0, createdHour: 9, overdueStartDate: null, revivedAt: null,
    archivedAt: null, isArchived: false, estimatedMinutes: null, actualMinutes: null,
    startedAt: null, parentId: null, childIds: [], depth: 0, category: 'personal',
    ...overrides,
  } as Task;
}

const DAY = 86400000;

describe('Phase 1.9 — decay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('formatOverdueGently returns "" for a task that is not overdue', () => {
    const task = makeTask({ deadline: Date.now() + DAY });
    expect(formatOverdueGently(task)).toBe('');
  });

  it('formatOverdueGently: "1 day ago" for exactly one day overdue', () => {
    const task = makeTask({ deadline: new Date(2026, 5, 14).getTime() });
    expect(formatOverdueGently(task)).toBe('1 day ago');
  });

  it('formatOverdueGently: "N days ago" for multi-day overdue', () => {
    const task = makeTask({ deadline: new Date(2026, 5, 10).getTime() });
    expect(formatOverdueGently(task)).toBe('5 days ago');
  });

  it('formatOverdueGently ignores completed tasks (no deadline math needed)', () => {
    const task = makeTask({ deadline: new Date(2026, 5, 1).getTime(), isCompleted: true, completedAt: Date.now() });
    expect(formatOverdueGently(task)).toBe('');
  });

  it('isFullyDecayed is false under 7 days overdue, true at/after 7', () => {
    const almost = makeTask({ deadline: Date.now() - 6 * DAY, overdueStartDate: Date.now() - 6 * DAY });
    const exactly = makeTask({ deadline: Date.now() - 7 * DAY, overdueStartDate: Date.now() - 7 * DAY });
    expect(isFullyDecayed(almost)).toBe(false);
    expect(isFullyDecayed(exactly)).toBe(true);
  });

  it('isFullyDecayed agrees with the displayed overdue day-count at the 7-day boundary (P1.3)', () => {
    // Both getDaysOverdue (shown via formatOverdueGently) and isFullyDecayed
    // now normalize to startOfDay, so they must never disagree. A deadline set
    // to start-of-day N days ago reads "N days ago" and is decayed iff N>=7.
    for (const n of [5, 6, 7, 8, 10]) {
      const deadline = new Date(2026, 5, 15 - n).getTime(); // n whole days before "now"
      const task = makeTask({ deadline, overdueStartDate: deadline });
      const label = formatOverdueGently(task);
      const shownDays = Number(/^(\d+)/.exec(label)?.[1] ?? '0');
      expect(shownDays).toBe(n);
      expect(isFullyDecayed(task)).toBe(n >= 7);
    }
  });

  it('isFullyDecayed is always false for completed, archived, or deadline-less tasks', () => {
    const base = { overdueStartDate: Date.now() - 30 * DAY };
    expect(isFullyDecayed(makeTask({ ...base, deadline: null }))).toBe(false);
    expect(isFullyDecayed(makeTask({ ...base, deadline: Date.now() - 30 * DAY, isCompleted: true, completedAt: Date.now() }))).toBe(false);
    expect(isFullyDecayed(makeTask({ ...base, deadline: Date.now() - 30 * DAY, isArchived: true }))).toBe(false);
  });

  it('initializeOverdueDates stamps overdueStartDate only for newly-overdue, untouched tasks', () => {
    const overdueNoStamp = makeTask({ id: 'a', deadline: Date.now() - DAY, overdueStartDate: null });
    const alreadyStamped = makeTask({ id: 'b', deadline: Date.now() - DAY, overdueStartDate: Date.now() - DAY });
    const notOverdue = makeTask({ id: 'c', deadline: Date.now() + DAY });
    const completed = makeTask({ id: 'd', deadline: Date.now() - DAY, isCompleted: true, completedAt: Date.now() });

    const result = initializeOverdueDates([overdueNoStamp, alreadyStamped, notOverdue, completed]);

    expect(result.find(t => t.id === 'a')!.overdueStartDate).not.toBeNull();
    expect(result.find(t => t.id === 'b')!.overdueStartDate).toBe(alreadyStamped.overdueStartDate);
    expect(result.find(t => t.id === 'c')!.overdueStartDate).toBeNull();
    expect(result.find(t => t.id === 'd')!.overdueStartDate).toBeNull();
  });

  it('initializeOverdueDates returns the same array reference when nothing changed', () => {
    const tasks = [makeTask({ deadline: Date.now() + DAY })];
    expect(initializeOverdueDates(tasks)).toBe(tasks);
  });
});
