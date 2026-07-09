import { describe, expect, it } from 'vitest';
import {
  isTaskLocked, getAllDescendantIds, getChildren,
  flattenTasksHierarchically, countDescendants,
} from '../../src/core/utils/dependencyChains';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1', title: 'Task', description: '',
    createdAt: 0, updatedAt: 0, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: false, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 9, overdueStartDate: null,
    revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
    actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0,
    category: 'personal',
    ...overrides,
  } as Task;
}

describe('Phase 1.9 — dependencyChains', () => {
  // root -> child1, child2; child1 -> grandchild
  const root = makeTask({ id: 'root', childIds: ['child1', 'child2'], createdAt: 0 });
  const child1 = makeTask({ id: 'child1', parentId: 'root', depth: 1, childIds: ['grandchild'], createdAt: 1 });
  const child2 = makeTask({ id: 'child2', parentId: 'root', depth: 1, createdAt: 2 });
  const grandchild = makeTask({ id: 'grandchild', parentId: 'child1', depth: 2, createdAt: 3 });
  const all = [root, child1, child2, grandchild];

  it('isTaskLocked is true when any direct child is incomplete', () => {
    expect(isTaskLocked(root, all)).toBe(true);
  });

  it('isTaskLocked is false once every child is completed', () => {
    const doneChildren = all.map(t => (t.id === 'child1' || t.id === 'child2') ? { ...t, isCompleted: true } : t);
    expect(isTaskLocked(root, doneChildren)).toBe(false);
  });

  it('isTaskLocked is false for a leaf task with no children', () => {
    expect(isTaskLocked(grandchild, all)).toBe(false);
  });

  it('getAllDescendantIds walks the full subtree, not just direct children', () => {
    expect(getAllDescendantIds('root', all).sort()).toEqual(['child1', 'child2', 'grandchild'].sort());
    expect(getAllDescendantIds('child1', all)).toEqual(['grandchild']);
    expect(getAllDescendantIds('grandchild', all)).toEqual([]);
  });

  it('getChildren returns only direct children', () => {
    expect(getChildren(root, all).map(t => t.id).sort()).toEqual(['child1', 'child2']);
  });

  it('countDescendants counts the whole subtree', () => {
    expect(countDescendants('root', all)).toBe(3);
    expect(countDescendants('grandchild', all)).toBe(0);
  });

  it('flattenTasksHierarchically places every child immediately after its parent, ordered by creation', () => {
    const shuffled = [grandchild, child2, root, child1];
    const flat = flattenTasksHierarchically(shuffled).map(t => t.id);
    expect(flat).toEqual(['root', 'child1', 'grandchild', 'child2']);
  });

  it('flattenTasksHierarchically appends orphaned tasks (dangling parentId) without losing them', () => {
    const orphan = makeTask({ id: 'orphan', parentId: 'ghost-parent', depth: 1, createdAt: 5 });
    const flat = flattenTasksHierarchically([root, child1, child2, grandchild, orphan]).map(t => t.id);
    expect(flat).toContain('orphan');
    expect(flat.length).toBe(5);
  });
});
