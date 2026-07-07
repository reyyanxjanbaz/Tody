import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { organizeTasks, searchTasks } from '../../src/core/utils/taskIntelligence';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? `t-${Math.random()}`, title: 'Task', description: '',
    createdAt: 0, updatedAt: 0, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: false, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 9, overdueStartDate: null,
    revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
    actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0,
    category: 'personal',
    ...overrides,
  } as Task;
}

describe('Phase 1.9 — taskIntelligence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0, 0)); // Mon Jun 15 2026, morning
  });
  afterEach(() => vi.useRealTimers());

  it('organizeTasks buckets by section: overdue (CARRY FORWARD), now (TODAY), next (NEXT FEW DAYS), later (LATER)', () => {
    const overdue = makeTask({ id: 'overdue', deadline: new Date(2026, 5, 14).getTime() });
    const now = makeTask({ id: 'now', deadline: new Date(2026, 5, 15, 20).getTime() });
    const next = makeTask({ id: 'next', deadline: new Date(2026, 5, 17).getTime() });
    const later = makeTask({ id: 'later', deadline: new Date(2026, 5, 25).getTime() });
    const someday = makeTask({ id: 'someday', deadline: null });

    const sections = organizeTasks([overdue, now, next, later, someday]);
    const byKey = Object.fromEntries(sections.map(s => [s.key, s]));

    expect(byKey.overdue.title).toBe('CARRY FORWARD');
    expect(byKey.now.title).toBe('TODAY');
    expect(byKey.next.title).toBe('NEXT FEW DAYS');
    expect(byKey.later.title).toBe('LATER');
    expect(byKey.overdue.data.map(t => t.id)).toEqual(['overdue']);
    expect(byKey.now.data.map(t => t.id)).toEqual(['now']);
    expect(byKey.next.data.map(t => t.id)).toEqual(['next']);
    expect(byKey.later.data.map(t => t.id)).toEqual(['later']);
    expect(byKey.someday.data.map(t => t.id)).toEqual(['someday']);
  });

  it('omits empty sections entirely', () => {
    const sections = organizeTasks([makeTask({ id: 'only-today', deadline: Date.now() })]);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('now');
  });

  it('filters out completed tasks', () => {
    const sections = organizeTasks([makeTask({ isCompleted: true, deadline: Date.now() })]);
    expect(sections).toHaveLength(0);
  });

  it('sorts a bucket with higher-urgency (overdue, high priority) tasks first', () => {
    const highPriorityOverdue = makeTask({ id: 'urgent', deadline: new Date(2026, 5, 10).getTime(), priority: 'high' });
    const lowPriorityOverdue = makeTask({ id: 'meh', deadline: new Date(2026, 5, 14).getTime(), priority: 'none' });
    const sections = organizeTasks([lowPriorityOverdue, highPriorityOverdue]);
    const overdueSection = sections.find(s => s.key === 'overdue')!;
    expect(overdueSection.data.map(t => t.id)).toEqual(['urgent', 'meh']);
  });

  it('keeps subtasks grouped with their root ancestor\'s section, ordered depth-then-creation after the root', () => {
    const root = makeTask({ id: 'root', deadline: Date.now(), createdAt: 0 });
    const child = makeTask({ id: 'child', parentId: 'root', depth: 1, deadline: null, createdAt: 1 });

    const sections = organizeTasks([child, root]);
    const nowSection = sections.find(s => s.key === 'now')!;
    expect(nowSection.data.map(t => t.id)).toEqual(['root', 'child']);
  });

  it('searchTasks matches title or description case-insensitively, and returns [] for a blank query', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Buy Milk' }),
      makeTask({ id: 'b', title: 'Groceries', description: 'includes milk and eggs' }),
      makeTask({ id: 'c', title: 'Unrelated' }),
    ];
    expect(searchTasks(tasks, 'milk').map(t => t.id).sort()).toEqual(['a', 'b']);
    expect(searchTasks(tasks, '   ')).toEqual([]);
  });
});
