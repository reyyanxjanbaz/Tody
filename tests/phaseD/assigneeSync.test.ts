import { describe, expect, it } from 'vitest';
import { taskToDbRow, dbRowToTask } from '../../src/core/lib/supabaseSync';
import type { Task } from '../../src/core/types';

const emptyCatMap = { toUUID: {} as Record<string, string>, toLocal: {} as Record<string, string> };

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1', title: 'x', description: '', createdAt: 1, updatedAt: 1,
    deadline: null, completedAt: null, priority: 'none', energyLevel: 'medium',
    isCompleted: false, isRecurring: false, recurringFrequency: null, deferCount: 0,
    createdHour: 0, childIds: [], depth: 0, ...overrides,
  };
}

/** Phase D — assignee_id must round-trip so an assignment survives a sync/echo. */
describe('Phase D — supabaseSync assignee_id mapping', () => {
  it('taskToDbRow writes assignee_id (member + null)', () => {
    expect(taskToDbRow(makeTask({ assigneeId: 'u-2' }), 'u1', emptyCatMap).assignee_id).toBe('u-2');
    expect(taskToDbRow(makeTask({ assigneeId: null }), 'u1', emptyCatMap).assignee_id).toBeNull();
    expect(taskToDbRow(makeTask({}), 'u1', emptyCatMap).assignee_id).toBeNull();
  });

  it('dbRowToTask reads assignee_id back', () => {
    const row = taskToDbRow(makeTask({ assigneeId: 'u-2' }), 'u1', emptyCatMap);
    expect(dbRowToTask(row as any, emptyCatMap).assigneeId).toBe('u-2');
    expect(dbRowToTask({ ...(row as any), assignee_id: null }, emptyCatMap).assigneeId).toBeNull();
  });
});
