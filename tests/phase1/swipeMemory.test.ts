import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadSwipeStats, recordSwipeAction, getRightSwipeOrder, getLeftSwipeOrder,
  resetSwipeMemoryCache, syncSwipeStatsFromCloud,
} from '../../src/core/utils/swipeMemory';
import { api } from '../../src/core/lib/api';

describe('Phase 1.9 — swipeMemory', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSwipeMemoryCache();
    vi.mocked(api.get).mockResolvedValue({ data: null, error: null, isBackendDown: false });
    vi.mocked(api.patch).mockResolvedValue({ data: null, error: null, isBackendDown: false });
  });

  it('loadSwipeStats seeds all-zero default counts when nothing is stored or cached', async () => {
    const stats = await loadSwipeStats();
    expect(stats.totalSwipes).toBe(0);
    expect(stats.counts).toEqual({ complete: 0, defer: 0, start: 0, subtask: 0, revive: 0, delete: 0 });
  });

  it('recordSwipeAction increments the matching count and total, and persists', async () => {
    await recordSwipeAction('defer');
    await recordSwipeAction('defer');
    const stats = await loadSwipeStats();
    expect(stats.counts.defer).toBe(2);
    expect(stats.totalSwipes).toBe(2);
    expect(localStorage.getItem('@tody_swipe_action_stats')).not.toBeNull();
  });

  it('auto-soft-resets (halves all counts) once totalSwipes reaches 100', async () => {
    for (let i = 0; i < 99; i++) await recordSwipeAction('complete');
    let stats = await loadSwipeStats();
    expect(stats.totalSwipes).toBe(99);

    await recordSwipeAction('complete'); // 100th -> triggers soft reset
    stats = await loadSwipeStats();
    expect(stats.totalSwipes).toBe(50);
    expect(stats.counts.complete).toBe(50);
  });

  it('getRightSwipeOrder falls back to default order+width under the 5-swipe data floor', () => {
    const order = getRightSwipeOrder({ counts: { defer: 1, start: 1, delete: 1 } as any, totalSwipes: 3, lastResetAt: 0 });
    expect(order).toEqual([
      { action: 'defer', relativeWidth: 1 },
      { action: 'start', relativeWidth: 1 },
      { action: 'delete', relativeWidth: 1 },
    ]);
  });

  it('getRightSwipeOrder ranks by usage (weighted 1.5/1/0.8) once past the data floor', () => {
    const order = getRightSwipeOrder({
      counts: { defer: 20, start: 5, delete: 1 } as any, totalSwipes: 26, lastResetAt: 0,
    });
    expect(order.map(o => o.action)).toEqual(['defer', 'start', 'delete']);
    expect(order[0].relativeWidth).toBe(1.5);
    expect(order[2].relativeWidth).toBe(0.8);
  });

  it('getLeftSwipeOrder ranks complete/subtask/revive by usage', () => {
    const order = getLeftSwipeOrder({
      counts: { complete: 1, subtask: 20, revive: 5 } as any, totalSwipes: 26, lastResetAt: 0,
    });
    expect(order.map(o => o.action)).toEqual(['subtask', 'revive', 'complete']);
  });

  it('syncSwipeStatsFromCloud hydrates local cache/storage from the API when present', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { swipe_stats: { counts: { complete: 9, defer: 0, start: 0, subtask: 0, revive: 0, delete: 0 }, totalSwipes: 9, lastResetAt: 0 } },
      error: null, isBackendDown: false,
    });
    await syncSwipeStatsFromCloud();
    const stats = await loadSwipeStats();
    expect(stats.counts.complete).toBe(9);
  });
});
