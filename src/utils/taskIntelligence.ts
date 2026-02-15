import { Task, Section, TaskSectionData } from '../types';
import { daysFromNow } from './dateUtils';

/**
 * Computes an urgency score in [0, 1] for a task.
 *
 * Factors (weighted):
 *   0.40 — Deadline proximity (exponential urgency as deadline approaches)
 *   0.30 — Priority level
 *   0.15 — Task age (older uncompleted → slightly higher)
 *   0.15 — Time-of-day relevance (morning tasks score higher in morning)
 *
 * Defer penalty: Each defer reduces score by 5% (capped at 30% reduction).
 */
function computeUrgencyScore(task: Task): number {
  let score = 0;

  // --- Deadline proximity (weight: 0.40) ---
  if (task.deadline) {
    const hoursUntil = (task.deadline - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 0) {
      score += 0.4; // overdue = max urgency on this axis
    } else if (hoursUntil < 24) {
      score += 0.4 * (1 - hoursUntil / 24);
    } else if (hoursUntil < 72) {
      score += 0.4 * Math.max(0, 0.5 - (hoursUntil - 24) / 96);
    } else {
      score += 0.4 * Math.max(0, 0.15 - hoursUntil / 1440);
    }
  }

  // --- Priority (weight: 0.30) ---
  const priorityMap = { high: 1, medium: 0.6, low: 0.3, none: 0.05 };
  score += 0.3 * priorityMap[task.priority];

  // --- Age: older uncompleted tasks drift upward (weight: 0.15) ---
  const ageHours = (Date.now() - task.createdAt) / (1000 * 60 * 60);
  score += 0.15 * Math.min(1, ageHours / 168); // caps at ~1 week

  // --- Time-of-day relevance (weight: 0.15) ---
  const currentHour = new Date().getHours();
  const isMorningNow = currentHour < 12;
  const wasMorningTask = task.createdHour < 12;
  score += isMorningNow === wasMorningTask ? 0.15 : 0.05;

  // --- Defer penalty ---
  if (task.deferCount > 0) {
    score *= Math.max(0.7, 1 - task.deferCount * 0.05);
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Determines which temporal section a task belongs to.
 */
function computeSection(task: Task): Section {
  if (!task.deadline) { return 'someday'; }

  const days = daysFromNow(task.deadline);
  if (days < 0) { return 'overdue'; }
  if (days === 0) { return 'now'; }
  if (days <= 3) { return 'next'; }
  return 'later';
}

const SECTION_META: ReadonlyArray<{ key: Section; title: string }> = [
  { key: 'overdue', title: 'CARRY FORWARD' },
  { key: 'now', title: 'TODAY' },
  { key: 'next', title: 'NEXT FEW DAYS' },
  { key: 'later', title: 'LATER' },
  { key: 'someday', title: 'SOMEDAY' },
];

/**
 * Organizes active tasks into smart temporal sections,
 * sorted by urgency score within each section.
 * Empty sections are omitted.
 */
export function organizeTasks(tasks: Task[]): TaskSectionData[] {
  const active = tasks.filter(t => !t.isCompleted);

  // Build a map from task ID to task for quick lookups
  const taskMap = new Map(active.map(t => [t.id, t]));

  // Find root ancestor for a task to place subtasks in same section as their root
  function getRootAncestor(task: Task): Task {
    let current = task;
    while (current.parentId) {
      const parent = taskMap.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const buckets: Record<Section, Task[]> = {
    overdue: [],
    now: [],
    next: [],
    later: [],
    someday: [],
  };

  for (const task of active) {
    // Place task in same section as its root ancestor
    const root = getRootAncestor(task);
    const section = task.parentId ? computeSection(root) : computeSection(task);
    buckets[section].push(task);
  }

  // Sort each bucket by urgency (highest first), but keep hierarchy intact
  for (const key of Object.keys(buckets) as Section[]) {
    // Sort root tasks by urgency, children will be re-ordered by flattenTasksHierarchically
    buckets[key].sort((a, b) => {
      const rootA = getRootAncestor(a);
      const rootB = getRootAncestor(b);
      if (rootA.id !== rootB.id) {
        return computeUrgencyScore(rootB) - computeUrgencyScore(rootA);
      }
      // Same root: sort by depth then creation time
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.createdAt - b.createdAt;
    });
  }

  return SECTION_META
    .filter(s => buckets[s.key].length > 0)
    .map(s => ({ key: s.key, title: s.title, data: buckets[s.key] }));
}

/**
 * Searches across all tasks (active + archived) by query string.
 * Case-insensitive, matches title and description.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.toLowerCase().trim();
  if (!q) { return []; }

  return tasks.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q),
  );
}
