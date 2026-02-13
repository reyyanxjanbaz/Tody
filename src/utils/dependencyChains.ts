import { Task } from '../types';

/** Maximum depth for subtask nesting */
export const MAX_DEPTH = 3;

/**
 * Whether a task is locked (has incomplete children).
 */
export function isTaskLocked(task: Task, allTasks: Task[]): boolean {
  const childIds = task.childIds ?? [];
  if (childIds.length === 0) return false;
  const children = allTasks.filter(t => childIds.includes(t.id));
  return children.some(child => !child.isCompleted);
}

/**
 * Get all descendant tasks recursively.
 */
export function getAllDescendants(taskId: string, allTasks: Task[]): Task[] {
  const task = allTasks.find(t => t.id === taskId);
  const childIds = task?.childIds ?? [];
  if (!task || childIds.length === 0) return [];

  const children = allTasks.filter(t => childIds.includes(t.id));
  const descendants = [...children];

  children.forEach(child => {
    descendants.push(...getAllDescendants(child.id, allTasks));
  });

  return descendants;
}

/**
 * Get all descendant IDs recursively.
 */
export function getAllDescendantIds(taskId: string, allTasks: Task[]): string[] {
  return getAllDescendants(taskId, allTasks).map(t => t.id);
}

/**
 * Get direct children of a task.
 */
export function getChildren(task: Task, allTasks: Task[]): Task[] {
  const childIds = task.childIds ?? [];
  return allTasks.filter(t => childIds.includes(t.id));
}

/**
 * Get parent task of a task.
 */
export function getParent(task: Task, allTasks: Task[]): Task | undefined {
  if (!task.parentId) return undefined;
  return allTasks.find(t => t.id === task.parentId);
}

/**
 * Check if setting `candidateParentId` as parent of `taskId` would create a circular dependency.
 */
export function wouldCreateCircular(
  taskId: string,
  candidateParentId: string,
  allTasks: Task[],
): boolean {
  if (taskId === candidateParentId) return true;
  const descendantIds = getAllDescendantIds(taskId, allTasks);
  return descendantIds.includes(candidateParentId);
}

/**
 * Get valid parent tasks for a given task (for "Move to..." menu).
 * Valid parents: any task at depth < MAX_DEPTH, excluding self and descendants.
 */
export function getValidParents(taskId: string, allTasks: Task[]): Task[] {
  const descendantIds = getAllDescendantIds(taskId, allTasks);
  return allTasks.filter(
    t =>
      t.id !== taskId &&
      !descendantIds.includes(t.id) &&
      (t.depth ?? 0) < MAX_DEPTH &&
      !t.isCompleted,
  );
}

/**
 * Flatten tasks into a hierarchical display order.
 * Children appear immediately after their parent, sorted by creation date.
 */
export function flattenTasksHierarchically(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const result: Task[] = [];
  const visited = new Set<string>();

  function insertTaskAndChildren(task: Task) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    result.push(task);

    // Insert children sorted by creation date
    const children = (task.childIds ?? [])
      .map(id => taskMap.get(id))
      .filter((t): t is Task => t != null)
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const child of children) {
      insertTaskAndChildren(child);
    }
  }

  // Start with root tasks (depth 0 or no parent)
  const rootTasks = tasks
    .filter(t => !t.parentId || (t.depth ?? 0) === 0)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const root of rootTasks) {
    insertTaskAndChildren(root);
  }

  // Add any orphaned tasks that weren't visited
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      result.push(task);
    }
  }

  return result;
}

/**
 * Count of descendants for deletion confirmation message.
 */
export function countDescendants(taskId: string, allTasks: Task[]): number {
  return getAllDescendants(taskId, allTasks).length;
}
