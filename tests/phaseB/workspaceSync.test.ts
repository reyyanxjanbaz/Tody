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

/** Phase B — the row mapper must carry workspace_id both directions so a task's
 *  workspace survives a sync round-trip (and NULL stays Personal). */
describe('Phase B — supabaseSync workspace_id mapping', () => {
  it('taskToDbRow writes workspace_id (named + null)', () => {
    expect(taskToDbRow(makeTask({ workspaceId: 'ws-1' }), 'u1', emptyCatMap).workspace_id).toBe('ws-1');
    expect(taskToDbRow(makeTask({ workspaceId: null }), 'u1', emptyCatMap).workspace_id).toBeNull();
    // Legacy task with no workspaceId → null (Personal)
    expect(taskToDbRow(makeTask({}), 'u1', emptyCatMap).workspace_id).toBeNull();
  });

  it('dbRowToTask reads workspace_id back (null → null = Personal)', () => {
    const base = taskToDbRow(makeTask({ workspaceId: 'ws-1' }), 'u1', emptyCatMap);
    const back = dbRowToTask(base as any, emptyCatMap);
    expect(back.workspaceId).toBe('ws-1');

    const personal = dbRowToTask({ ...(base as any), workspace_id: null }, emptyCatMap);
    expect(personal.workspaceId).toBeNull();
  });
});
