import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadTombstones, loadTombstoneIds, recordTombstone, recordTombstones,
  clearTombstone, TOMBSTONE_TTL_MS,
} from '../../src/core/utils/tombstones';

describe('Phase 1.10 — deletion tombstones', () => {
  beforeEach(() => localStorage.clear());

  it('records and reads back an id', async () => {
    await recordTombstone('tasks', 'a');
    expect(await loadTombstoneIds('tasks')).toEqual(new Set(['a']));
  });

  it('records many ids at once, de-duping', async () => {
    await recordTombstones('tasks', ['a', 'b', 'a']);
    await recordTombstone('tasks', 'b'); // dup
    expect(await loadTombstoneIds('tasks')).toEqual(new Set(['a', 'b']));
  });

  it('keeps kinds separate (tasks vs inbox vs categories)', async () => {
    await recordTombstone('tasks', 'a');
    await recordTombstone('inbox', 'b');
    expect(await loadTombstoneIds('tasks')).toEqual(new Set(['a']));
    expect(await loadTombstoneIds('inbox')).toEqual(new Set(['b']));
    expect(await loadTombstoneIds('categories')).toEqual(new Set());
  });

  it('prunes entries older than the TTL on read', async () => {
    const now = 10_000_000_000_000;
    await recordTombstone('tasks', 'fresh', now);
    await recordTombstone('tasks', 'stale', now - TOMBSTONE_TTL_MS - 1);
    const ids = await loadTombstoneIds('tasks', now);
    expect(ids.has('fresh')).toBe(true);
    expect(ids.has('stale')).toBe(false);
  });

  it('clearTombstone removes a single id', async () => {
    await recordTombstones('tasks', ['a', 'b']);
    await clearTombstone('tasks', 'a');
    expect(await loadTombstoneIds('tasks')).toEqual(new Set(['b']));
  });

  it('loadTombstones returns records with deletedAt timestamps', async () => {
    const now = 1_700_000_000_000;
    await recordTombstone('tasks', 'a', now);
    const recs = await loadTombstones('tasks', now);
    expect(recs).toEqual([{ id: 'a', deletedAt: now }]);
  });
});
