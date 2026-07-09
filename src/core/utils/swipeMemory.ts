import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './storage';
import { api } from '../lib/api';

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

/** Called on logout to prevent cross-user stat bleed. */
export function resetSwipeMemoryCache(): void {
  cachedStats = null;
}

// ── Cloud sync helpers ────────────────────────────────────────────────────────

/** Pull swipe_stats from the user’s profile row and hydrate local storage (best-effort). */
export async function syncSwipeStatsFromCloud(): Promise<void> {
  try {
    const { data } = await api.get<{ swipe_stats?: SwipeStats | null }>('/profile');
    if (!data?.swipe_stats) return;
    cachedStats = data.swipe_stats as SwipeStats;
    await AsyncStorage.setItem(KEYS.SWIPE_STATS, JSON.stringify(cachedStats));
  } catch { /* best-effort */ }
}

async function pushSwipeStatsToCloud(stats: SwipeStats): Promise<void> {
  try {
    await api.patch('/profile', { swipe_stats: stats });
  } catch { /* best-effort */ }
}
/**
 * Feature: Swipe Action Memory
 *
 * Tracks which swipe actions the user performs most frequently.
 * Soft-resets every 100 swipes to adapt to changing behaviour.
 * Stats are persisted locally (KEYS.SWIPE_STATS) and synced to the cloud.
 */
export async function loadSwipeStats(): Promise<SwipeStats> {
  if (cachedStats) return cachedStats;

  try {
    const data = await AsyncStorage.getItem(KEYS.SWIPE_STATS);
    if (data) {
      cachedStats = JSON.parse(data) as SwipeStats;
      return cachedStats;
    }
  } catch { /* fall through */ }

  // Nothing locally — try cloud once
  try {
    const { data: profile } = await api.get<{ swipe_stats?: SwipeStats | null }>('/profile');
    if (profile?.swipe_stats) {
      cachedStats = profile.swipe_stats as SwipeStats;
      await AsyncStorage.setItem(KEYS.SWIPE_STATS, JSON.stringify(cachedStats));
      return cachedStats;
    }
  } catch { /* best-effort */ }

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
  await AsyncStorage.setItem(KEYS.SWIPE_STATS, JSON.stringify(stats));
  // Async cloud sync — non-blocking
  pushSwipeStatsToCloud(stats).catch(() => {});
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
