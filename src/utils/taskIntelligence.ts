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

// ── Smart Sort ─────────────────────────────────────────────────────────────

/**
 * computeSmartSortScore — composite ranking that blends
 * deadline urgency, priority weight, energy alignment,
 * time estimates and task age into a single [0,1] score.
 *
 * Algorithm:
 *   35% — Deadline urgency (exponential curve, overdue = max)
 *   30% — Priority weight (high > medium > low > none)
 *   15% — Energy–time-of-day alignment (high energy tasks in the AM, low in PM)
 *   10% — Estimated duration (shorter tasks nudged up for quick wins)
 *   10% — Task age / staleness (older items drift up)
 *
 * Adjustments:
 *   • Defer penalty: each defer reduces score by 4% (capped at 25%)
 *   • In-progress bonus: +0.08 if task was started (keep momentum)
 *   • Overdue boost: hard floor of 0.70 so overdue always floats near top
 */
export function computeSmartSortScore(task: Task): number {
  let score = 0;
  const now = Date.now();

  // ── 1. Deadline urgency (35%) ──────────────────────────────────────────
  if (task.deadline) {
    const hoursUntil = (task.deadline - now) / (1000 * 60 * 60);
    if (hoursUntil < 0) {
      // Overdue: max urgency, more overdue = higher
      const overdueHours = Math.abs(hoursUntil);
      score += 0.35 * Math.min(1, 0.85 + overdueHours / 720); // caps ~30 days
    } else if (hoursUntil < 6) {
      score += 0.35 * 0.95; // due in < 6 hours — near-max urgency
    } else if (hoursUntil < 24) {
      score += 0.35 * (0.65 + 0.30 * (1 - hoursUntil / 24));
    } else if (hoursUntil < 72) {
      score += 0.35 * (0.35 + 0.30 * (1 - (hoursUntil - 24) / 48));
    } else if (hoursUntil < 168) {
      score += 0.35 * (0.15 + 0.20 * (1 - (hoursUntil - 72) / 96));
    } else {
      score += 0.35 * Math.max(0.02, 0.15 - hoursUntil / 2400);
    }
  } else {
    // No deadline: neutral baseline
    score += 0.35 * 0.10;
  }

  // ── 2. Priority (30%) ─────────────────────────────────────────────────
  const priorityWeight: Record<string, number> = {
    high: 1.0,
    medium: 0.6,
    low: 0.25,
    none: 0.05,
  };
  score += 0.30 * (priorityWeight[task.priority] ?? 0.05);

  // ── 3. Energy alignment (15%) ─────────────────────────────────────────
  const currentHour = new Date().getHours();
  const energyScore = (() => {
    // Morning (5–12): favour high energy tasks
    // Afternoon (12–17): favour medium energy tasks
    // Evening (17–23): favour low energy tasks
    if (currentHour >= 5 && currentHour < 12) {
      if (task.energyLevel === 'high') return 1.0;
      if (task.energyLevel === 'medium') return 0.5;
      return 0.2;
    }
    if (currentHour >= 12 && currentHour < 17) {
      if (task.energyLevel === 'medium') return 1.0;
      if (task.energyLevel === 'high') return 0.6;
      return 0.4;
    }
    // Evening/night
    if (task.energyLevel === 'low') return 1.0;
    if (task.energyLevel === 'medium') return 0.5;
    return 0.2;
  })();
  score += 0.15 * energyScore;

  // ── 4. Duration estimate (10%) — favour quick wins ────────────────────
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    // Short tasks (≤15min) get boost, long tasks (>120min) get slight penalty
    const durationFactor = task.estimatedMinutes <= 15
      ? 1.0
      : task.estimatedMinutes <= 30
        ? 0.8
        : task.estimatedMinutes <= 60
          ? 0.5
          : task.estimatedMinutes <= 120
            ? 0.3
            : 0.15;
    score += 0.10 * durationFactor;
  } else {
    score += 0.10 * 0.4; // no estimate: neutral
  }

  // ── 5. Task age / staleness (10%) ─────────────────────────────────────
  const ageHours = (now - task.createdAt) / (1000 * 60 * 60);
  score += 0.10 * Math.min(1, ageHours / 168); // caps at 1 week

  // ── Adjustments ───────────────────────────────────────────────────────

  // In-progress bonus
  if (task.startedAt && !task.isCompleted) {
    score += 0.08;
  }

  // Defer penalty
  if (task.deferCount > 0) {
    score *= Math.max(0.75, 1 - task.deferCount * 0.04);
  }

  // Overdue hard floor — overdue tasks should always rank near the top
  if (task.deadline && task.deadline < now) {
    score = Math.max(0.70, score);
  }

  return Math.min(1, Math.max(0, score));
}
