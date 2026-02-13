import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPE_STATS_KEY = '@tody_swipe_action_stats';

export type SwipeAction = 'complete' | 'defer' | 'start' | 'subtask' | 'revive' | 'delete';

interface SwipeStats {
  counts: Record<SwipeAction, number>;
  totalSwipes: number;
  lastResetAt: number;
}

const DEFAULT_STATS: SwipeStats = {
  counts: {
    complete: 0,
    defer: 0,
    start: 0,
    subtask: 0,
    revive: 0,
    delete: 0,
  },
  totalSwipes: 0,
  lastResetAt: Date.now(),
};

let cachedStats: SwipeStats | null = null;

/**
 * Feature 4: Swipe Action Memory
 * 
 * Tracks which swipe actions the user performs most frequently.
 * After every 20 swipes, ranking is recalculated.
 * Resets every 100 swipes to adapt to changing behavior.
 */
export async function loadSwipeStats(): Promise<SwipeStats> {
  if (cachedStats) return cachedStats;

  try {
    const data = await AsyncStorage.getItem(SWIPE_STATS_KEY);
    if (data) {
      cachedStats = JSON.parse(data);
      return cachedStats!;
    }
  } catch { }

  cachedStats = { ...DEFAULT_STATS };
  return cachedStats;
}

export async function recordSwipeAction(action: SwipeAction): Promise<void> {
  const stats = await loadSwipeStats();
  stats.counts[action] = (stats.counts[action] || 0) + 1;
  stats.totalSwipes += 1;

  // Auto-reset after 100 swipes to allow behavior adaptation
  if (stats.totalSwipes >= 100) {
    // Soft reset: halve all counts instead of zeroing
    for (const key of Object.keys(stats.counts) as SwipeAction[]) {
      stats.counts[key] = Math.floor(stats.counts[key] / 2);
    }
    stats.totalSwipes = Math.floor(stats.totalSwipes / 2);
    stats.lastResetAt = Date.now();
  }

  cachedStats = stats;
  await AsyncStorage.setItem(SWIPE_STATS_KEY, JSON.stringify(stats));
}

/**
 * Returns the ordering of right-side swipe actions, most-used first.
 * Includes proportional widths based on usage frequency.
 */
export function getRightSwipeOrder(stats: SwipeStats): Array<{
  action: SwipeAction;
  relativeWidth: number;
}> {
  const rightActions: SwipeAction[] = ['defer', 'start', 'delete'];
  const totalRight = rightActions.reduce((sum, a) => sum + (stats.counts[a] || 0), 0);

  if (totalRight < 5) {
    // Not enough data — use default order
    return rightActions.map(a => ({ action: a, relativeWidth: 1 }));
  }

  const sorted = [...rightActions].sort(
    (a, b) => (stats.counts[b] || 0) - (stats.counts[a] || 0),
  );

  return sorted.map((action, index) => ({
    action,
    relativeWidth: index === 0 ? 1.5 : index === 1 ? 1 : 0.8,
  }));
}

/**
 * Returns the ordering of left-side swipe actions, most-used first.
 */
export function getLeftSwipeOrder(stats: SwipeStats): Array<{
  action: SwipeAction;
  relativeWidth: number;
}> {
  const leftActions: SwipeAction[] = ['complete', 'subtask', 'revive'];
  const totalLeft = leftActions.reduce((sum, a) => sum + (stats.counts[a] || 0), 0);

  if (totalLeft < 5) {
    return leftActions.map(a => ({ action: a, relativeWidth: 1 }));
  }

  const sorted = [...leftActions].sort(
    (a, b) => (stats.counts[b] || 0) - (stats.counts[a] || 0),
  );

  return sorted.map((action, index) => ({
    action,
    relativeWidth: index === 0 ? 1.5 : index === 1 ? 1 : 0.8,
  }));
}
