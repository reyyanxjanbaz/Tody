import { Task } from '../types';
import { startOfDay } from './dateUtils';

const DECAY_DAYS = 7;
const MIN_OPACITY = 0.3;
const DECAY_PER_DAY = (1.0 - MIN_OPACITY) / DECAY_DAYS; // ~0.1 per day

/**
 * Calculates the visual opacity of a task based on how long it's been overdue.
 * Tasks decay from 1.0 → 0.3 over 7 days past their deadline.
 */
export function getTaskOpacity(task: Task): number {
  if (!task.deadline || task.completedAt || task.isCompleted) {
    return 1.0;
  }

  const now = Date.now();
  const deadlineTime = task.deadline;

  // Not overdue yet
  if (now <= deadlineTime) {
    return 1.0;
  }

  const overdueStart = task.overdueStartDate || deadlineTime;
  const msSinceOverdue = now - overdueStart;
  const daysSinceOverdue = Math.floor(msSinceOverdue / (1000 * 60 * 60 * 24));

  if (daysSinceOverdue >= DECAY_DAYS) {
    return MIN_OPACITY;
  }

  // Linear decay: 1.0 → 0.3 over 7 days
  return Math.max(MIN_OPACITY, 1.0 - daysSinceOverdue * DECAY_PER_DAY);
}

/**
 * Returns the number of days a task has been overdue (0 if not overdue).
 */
export function getDaysOverdue(task: Task): number {
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
