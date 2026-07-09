import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TaskProvider, useTasks } from '../../src/core/context/TaskContext';
import { AuthedShell } from './testUtils';
import { getTasks, getArchivedTasks } from '../../src/core/utils/storage';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthedShell>
      <TaskProvider>{children}</TaskProvider>
    </AuthedShell>
  );
}

async function setupLoaded() {
  const { result } = renderHook(() => useTasks(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe('Phase 1.6 — TaskContext', () => {
  beforeEach(() => localStorage.clear());

  it('addTask parses natural-language input into a structured task and prepends it', async () => {
    const result = await setupLoaded();

    act(() => {
      result.current.addTask('urgent fix deploy');
    });

    expect(result.current.tasks[0].title).toBe('fix deploy');
    expect(result.current.tasks[0].priority).toBe('high');
    expect(result.current.tasks[0].deadline).not.toBeNull();
  });

  it('completeTask marks a task complete, and computes actualMinutes when it was started', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => {
      taskId = result.current.addTask('write report').id;
    });
    act(() => {
      result.current.startTask(taskId);
    });
    act(() => {
      result.current.completeTask(taskId);
    });

    const task = result.current.tasks.find(t => t.id === taskId)!;
    expect(task.isCompleted).toBe(true);
    expect(task.completedAt).not.toBeNull();
    expect(task.actualMinutes).not.toBeNull();
  });

  it('completeTask leaves actualMinutes null when the task was never started', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => {
      taskId = result.current.addTask('quick note').id;
    });
    act(() => {
      result.current.completeTask(taskId);
    });
    expect(result.current.tasks.find(t => t.id === taskId)!.actualMinutes).toBeNull();
  });

  it('deferTask pushes the deadline to tomorrow end-of-day and increments deferCount', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => {
      taskId = result.current.addTask('reschedule me').id;
    });
    act(() => {
      result.current.deferTask(taskId);
    });

    const task = result.current.tasks.find(t => t.id === taskId)!;
    const deadline = new Date(task.deadline!);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(deadline.getDate()).toBe(tomorrow.getDate());
    expect(deadline.getHours()).toBe(23);
    expect(deadline.getMinutes()).toBe(59);
    expect(task.deferCount).toBe(1);
  });

  it('archiveTask moves the task out of active tasks and into archivedTasks', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => {
      taskId = result.current.addTask('archive me').id;
    });
    act(() => {
      result.current.archiveTask(taskId);
    });

    expect(result.current.tasks.find(t => t.id === taskId)).toBeUndefined();
    const archived = result.current.archivedTasks.find(t => t.id === taskId);
    expect(archived?.isArchived).toBe(true);
    expect(archived?.archivedAt).not.toBeNull();
  });

  it('addSubtask sets depth/parentId/childIds and rejects nesting past depth 3', async () => {
    const result = await setupLoaded();
    let rootId = '';
    act(() => {
      rootId = result.current.addTask('root').id;
    });

    let d1 = '', d2 = '', d3 = '';
    act(() => { d1 = result.current.addSubtask(rootId, 'depth1')!.id; });
    act(() => { d2 = result.current.addSubtask(d1, 'depth2')!.id; });
    act(() => { d3 = result.current.addSubtask(d2, 'depth3')!.id; });

    expect(result.current.tasks.find(t => t.id === d1)!.depth).toBe(1);
    expect(result.current.tasks.find(t => t.id === d2)!.depth).toBe(2);
    expect(result.current.tasks.find(t => t.id === d3)!.depth).toBe(3);
    expect(result.current.tasks.find(t => t.id === rootId)!.childIds).toEqual([d1]);

    // depth-3 parent is at max depth -> subtask creation must be rejected
    let rejected: unknown = 'not-called';
    act(() => {
      rejected = result.current.addSubtask(d3, 'depth4');
    });
    expect(rejected).toBeNull();
  });

  it('deleteTaskWithCascade removes a task and every descendant', async () => {
    const result = await setupLoaded();
    let rootId = '', childId = '', grandchildId = '';
    act(() => { rootId = result.current.addTask('root').id; });
    act(() => { childId = result.current.addSubtask(rootId, 'child')!.id; });
    act(() => { grandchildId = result.current.addSubtask(childId, 'grandchild')!.id; });

    act(() => {
      result.current.deleteTaskWithCascade(rootId);
    });

    const ids = result.current.tasks.map(t => t.id);
    expect(ids).not.toContain(rootId);
    expect(ids).not.toContain(childId);
    expect(ids).not.toContain(grandchildId);
  });

  it('P1.10 — deleting a task tombstones its id so a later sync cannot resurrect it', async () => {
    const { loadTombstoneIds } = await import('../../src/core/utils/tombstones');
    const result = await setupLoaded();
    let id = '';
    act(() => { id = result.current.addTask('delete and stay gone').id; });
    act(() => { result.current.deleteTask(id); });

    await waitFor(async () => {
      expect((await loadTombstoneIds('tasks')).has(id)).toBe(true);
    });
  });

  it('moveTaskToParent re-parents a task and recomputes depth for it and its descendants', async () => {
    const result = await setupLoaded();
    let taskA = '', taskB = '', child = '';
    act(() => { taskA = result.current.addTask('A').id; });
    act(() => { taskB = result.current.addTask('B').id; });
    act(() => { child = result.current.addSubtask(taskA, 'child-of-A')!.id; });

    act(() => {
      result.current.moveTaskToParent(child, taskB);
    });

    expect(result.current.tasks.find(t => t.id === child)!.parentId).toBe(taskB);
    expect(result.current.tasks.find(t => t.id === child)!.depth).toBe(1);
    expect(result.current.tasks.find(t => t.id === taskA)!.childIds).not.toContain(child);
    expect(result.current.tasks.find(t => t.id === taskB)!.childIds).toContain(child);
  });

  it('restoreTasks re-inserts previously removed tasks (Undo) without duplicating existing ones', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => { taskId = result.current.addTask('will delete').id; });
    const snapshot = result.current.tasks.find(t => t.id === taskId)!;
    act(() => { result.current.deleteTask(taskId); });
    expect(result.current.tasks.find(t => t.id === taskId)).toBeUndefined();

    act(() => { result.current.restoreTasks([snapshot]); });
    expect(result.current.tasks.find(t => t.id === taskId)).toBeDefined();

    // Restoring again with the same snapshot must not duplicate it.
    const countBefore = result.current.tasks.length;
    act(() => { result.current.restoreTasks([snapshot]); });
    expect(result.current.tasks.length).toBe(countBefore);
  });

  it('category CRUD: add, update, reorder, and delete (reassigning that category\'s tasks)', async () => {
    const result = await setupLoaded();
    let catId = '';
    act(() => {
      catId = result.current.addCategory('Shopping', 'cart-outline', '#ff0000').id;
    });
    expect(result.current.categories.find(c => c.id === catId)?.name).toBe('Shopping');

    act(() => {
      result.current.updateCategory(catId, { name: 'Groceries' });
    });
    expect(result.current.categories.find(c => c.id === catId)?.name).toBe('Groceries');

    let taskId = '';
    act(() => { taskId = result.current.addTask('milk', { category: catId }).id; });

    act(() => {
      result.current.reorderCategories([catId, 'overview', 'work', 'personal', 'health']);
    });
    expect(result.current.categories.find(c => c.id === catId)?.order).toBe(0);

    act(() => {
      result.current.deleteCategory(catId);
    });
    expect(result.current.categories.find(c => c.id === catId)).toBeUndefined();
    expect(result.current.tasks.find(t => t.id === taskId)?.category).toBe('personal');
    expect(result.current.activeCategory).toBe('overview');
  });

  it('debounce-persists tasks to storage ~500ms after a change', async () => {
    const result = await setupLoaded();
    act(() => {
      result.current.addTask('persisted task');
    });

    await waitFor(async () => {
      const stored = await getTasks<{ title: string }>();
      expect(stored.some(t => t.title === 'persisted task')).toBe(true);
    }, { timeout: 2000 });
  });

  it('debounce-persists archived tasks to storage', async () => {
    const result = await setupLoaded();
    let taskId = '';
    act(() => { taskId = result.current.addTask('to archive').id; });
    act(() => { result.current.archiveTask(taskId); });

    await waitFor(async () => {
      const stored = await getArchivedTasks<{ id: string }>();
      expect(stored.some(t => t.id === taskId)).toBe(true);
    }, { timeout: 2000 });
  });

  // ── Phase 3.1 — recurring spawn ──────────────────────────────────────────────

  it('completing a recurring task spawns the next instance with an advanced deadline', async () => {
    const result = await setupLoaded();
    const deadline = new Date(2030, 2, 10, 23, 59).getTime();
    let id = '';
    act(() => {
      id = result.current.addTask('water the plants', {
        isRecurring: true, recurringFrequency: 'daily', deadline,
      }).id;
    });
    act(() => { result.current.completeTask(id); });

    const spawn = result.current.tasks.find(t => t.id !== id && t.title === 'water the plants');
    expect(spawn).toBeDefined();
    expect(spawn!.isCompleted).toBe(false);
    expect(spawn!.isRecurring).toBe(true);
    expect(spawn!.deadline).toBe(new Date(2030, 2, 11, 23, 59).getTime());
    expect(spawn!.deferCount).toBe(0);
    expect(spawn!.completedAt).toBeNull();
  });

  it('does not spawn for a non-recurring task', async () => {
    const result = await setupLoaded();
    let id = '';
    act(() => { id = result.current.addTask('one-off errand', { deadline: Date.now() }).id; });
    act(() => { result.current.completeTask(id); });
    expect(result.current.tasks.filter(t => t.title === 'one-off errand')).toHaveLength(1);
  });

  it('does not double-spawn on complete -> uncomplete -> complete', async () => {
    const result = await setupLoaded();
    const deadline = new Date(2030, 2, 10, 23, 59).getTime();
    let id = '';
    act(() => {
      id = result.current.addTask('daily standup', {
        isRecurring: true, recurringFrequency: 'daily', deadline,
      }).id;
    });
    act(() => { result.current.completeTask(id); });
    act(() => { result.current.uncompleteTask(id); });
    act(() => { result.current.completeTask(id); });

    // Exactly one live next-instance despite two completions.
    const spawns = result.current.tasks.filter(
      t => t.id !== id && t.title === 'daily standup' && !t.isCompleted,
    );
    expect(spawns).toHaveLength(1);
  });

  it('does not spawn when a recurring task has no deadline', async () => {
    const result = await setupLoaded();
    let id = '';
    act(() => {
      id = result.current.addTask('someday recurring', {
        isRecurring: true, recurringFrequency: 'weekly', deadline: null,
      }).id;
    });
    act(() => { result.current.completeTask(id); });
    expect(result.current.tasks.filter(t => t.title === 'someday recurring')).toHaveLength(1);
  });
});
