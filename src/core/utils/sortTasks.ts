import type { SortOption, Task } from '../types';

/**
 * Flat task sorting for the non-default sort orders (the 'default' order keeps
 * the smart temporal sections from organizeTasks and is handled by the caller).
 * Mirrors the native SortDropdown's options.
 */

const PRIORITY_RANK: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2, none: 3 };

/** Tasks with no deadline sort last for deadline orders. */
function byDeadline(a: Task, b: Task, dir: 1 | -1): number {
  const av = a.deadline ?? Infinity;
  const bv = b.deadline ?? Infinity;
  if (av === bv) return a.createdAt - b.createdAt;
  if (av === Infinity) return 1;
  if (bv === Infinity) return -1;
  return (av - bv) * dir;
}

export function sortTasks(tasks: Task[], option: SortOption): Task[] {
  const active = tasks.filter((t) => !t.isCompleted);
  const list = [...active];
  switch (option) {
    case 'deadline-asc':
      return list.sort((a, b) => byDeadline(a, b, 1));
    case 'deadline-desc':
      return list.sort((a, b) => byDeadline(a, b, -1));
    case 'priority-high':
      return list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt);
    case 'priority-low':
      return list.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.createdAt - b.createdAt);
    case 'newest':
      return list.sort((a, b) => b.createdAt - a.createdAt);
    case 'oldest':
      return list.sort((a, b) => a.createdAt - b.createdAt);
    case 'default':
    case 'smart':
    default:
      return list;
  }
}

export const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'default', label: 'Default (Sections)', icon: 'layers-outline' },
  { key: 'deadline-asc', label: 'Deadline — soonest', icon: 'arrow-up-outline' },
  { key: 'deadline-desc', label: 'Deadline — latest', icon: 'arrow-down-outline' },
  { key: 'priority-high', label: 'Priority — high first', icon: 'flag' },
  { key: 'priority-low', label: 'Priority — low first', icon: 'flag-outline' },
  { key: 'newest', label: 'Created — newest', icon: 'time-outline' },
  { key: 'oldest', label: 'Created — oldest', icon: 'hourglass-outline' },
];
