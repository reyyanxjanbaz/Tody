import { describe, expect, it } from 'vitest';
import { sortTasks, SORT_OPTIONS } from '../../src/core/utils/sortTasks';
import type { Task } from '../../src/core/types';

function mk(overrides: Partial<Task>): Task {
  return {
    id: 't', title: 'T', description: '', createdAt: 0, updatedAt: 0,
    deadline: null, completedAt: null, priority: 'none', energyLevel: 'medium',
    isCompleted: false, isRecurring: false, recurringFrequency: null, deferCount: 0,
    createdHour: 9, overdueStartDate: null, revivedAt: null, archivedAt: null,
    isArchived: false, estimatedMinutes: null, actualMinutes: null, startedAt: null,
    parentId: null, childIds: [], depth: 0, category: 'personal',
    ...overrides,
  } as Task;
}

describe('Phase 2 (G3) — sortTasks comparators', () => {
  const a = mk({ id: 'a', createdAt: 100, deadline: 300, priority: 'low' });
  const b = mk({ id: 'b', createdAt: 200, deadline: 100, priority: 'high' });
  const c = mk({ id: 'c', createdAt: 50, deadline: null, priority: 'medium' });
  const all = [a, b, c];

  it('deadline-asc puts soonest first, no-deadline last', () => {
    expect(sortTasks(all, 'deadline-asc').map(t => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('deadline-desc puts latest first, no-deadline last', () => {
    expect(sortTasks(all, 'deadline-desc').map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('priority-high ranks high→none', () => {
    expect(sortTasks(all, 'priority-high').map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('priority-low ranks none→high', () => {
    expect(sortTasks(all, 'priority-low').map(t => t.id)).toEqual(['a', 'c', 'b']);
  });

  it('newest / oldest sort by createdAt', () => {
    expect(sortTasks(all, 'newest').map(t => t.id)).toEqual(['b', 'a', 'c']);
    expect(sortTasks(all, 'oldest').map(t => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('default/smart return the list unsorted (sections handled elsewhere)', () => {
    expect(sortTasks(all, 'default').map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('excludes completed tasks from every sort', () => {
    const withDone = [...all, mk({ id: 'done', isCompleted: true, completedAt: 1 })];
    expect(sortTasks(withDone, 'newest').some(t => t.id === 'done')).toBe(false);
  });

  it('SORT_OPTIONS lists the 7 dropdown entries with the expected labels', () => {
    const labels = SORT_OPTIONS.map(o => o.label);
    expect(labels).toContain('Deadline — soonest');
    expect(labels).toContain('Priority — high first');
    expect(labels).toContain('Created — newest');
    expect(SORT_OPTIONS).toHaveLength(7);
  });
});
