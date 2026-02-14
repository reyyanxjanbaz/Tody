import { Task } from '../types';
import { startOfDay } from './dateUtils';

const DECAY_DAYS = 7;
const MIN_OPACITY = 0.3;

/**
 * Returns the number of days a task has been overdue (0 if not overdue).
 */
function getDaysOverdue(task: Task): number {
  if (!task.deadline || task.completedAt || task.isCompleted) {
    return 0;
  }

  const now = startOfDay().getTime();
  const deadline = startOfDay(new Date(task.deadline)).getTime();

  if (now <= deadline) {
    return 0;
  }

  return Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
}

/**
 * Formats overdue duration in a gentle way: "3 days ago" instead of "3 days overdue"
 */
export function formatOverdueGently(task: Task): string {
  const days = getDaysOverdue(task);
  if (days === 0) {
    return '';
  }
  if (days === 1) {
    return '1 day ago';
  }
  return `${days} days ago`;
}

/**
 * Checks if a task is fully decayed (7+ days overdue) and eligible for archive.
 */
export function isFullyDecayed(task: Task): boolean {
  if (!task.deadline || task.completedAt || task.isCompleted || task.isArchived) {
    return false;
  }

  const now = Date.now();
  const overdueStart = task.overdueStartDate || task.deadline;
  const daysSinceOverdue = Math.floor(
    (now - overdueStart) / (1000 * 60 * 60 * 24),
  );

  return daysSinceOverdue >= DECAY_DAYS;
}

/**
 * Scans tasks and sets overdueStartDate for tasks that have become overdue
 * but don't have the field set yet. Called on app mount.
 */
export function initializeOverdueDates(tasks: Task[]): Task[] {
  const now = Date.now();
  let changed = false;

  const updated = tasks.map(task => {
    if (
      task.deadline &&
      !task.completedAt &&
      !task.isCompleted &&
      now > task.deadline &&
      !task.overdueStartDate
    ) {
      changed = true;
      return {
        ...task,
        overdueStartDate: task.deadline,
        updatedAt: now,
      };
    }
    return task;
  });

  return changed ? updated : tasks;
}
