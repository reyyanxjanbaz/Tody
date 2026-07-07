import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Deletion tombstones — the client-side half of the cross-device
 * delete-resurrection fix.
 *
 * The sync flow's "push all local rows" step (TaskContext/InboxContext) would
 * otherwise re-insert a row that this device had deleted but whose DELETE
 * hasn't propagated yet, resurrecting it everywhere. We keep a small persisted
 * record of ids this device deleted (with when), and exclude them from any
 * push. Entries are pruned after TOMBSTONE_TTL so the list stays bounded — by
 * then the deletion has certainly synced (server soft-delete propagates it to
 * other devices via the incremental sync feed).
 */

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Tombstone {
  id: string;
  deletedAt: number;
}

const KEY_PREFIX = 'tody:tombstones:'; // + kind ('tasks' | 'inbox' | 'categories')

export type TombstoneKind = 'tasks' | 'inbox' | 'categories';

export async function loadTombstones(kind: TombstoneKind, now = Date.now()): Promise<Tombstone[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + kind);
    const all: Tombstone[] = raw ? JSON.parse(raw) : [];
    // Prune expired on read so the store self-cleans.
    const live = all.filter((t) => now - t.deletedAt < TOMBSTONE_TTL_MS);
    if (live.length !== all.length) {
      await AsyncStorage.setItem(KEY_PREFIX + kind, JSON.stringify(live));
    }
    return live;
  } catch {
    return [];
  }
}

export async function loadTombstoneIds(kind: TombstoneKind, now = Date.now()): Promise<Set<string>> {
  return new Set((await loadTombstones(kind, now)).map((t) => t.id));
}

export async function recordTombstone(kind: TombstoneKind, id: string, now = Date.now()): Promise<void> {
  try {
    const existing = await loadTombstones(kind, now);
    if (existing.some((t) => t.id === id)) return;
    existing.push({ id, deletedAt: now });
    await AsyncStorage.setItem(KEY_PREFIX + kind, JSON.stringify(existing));
  } catch {
    /* best effort */
  }
}

export async function recordTombstones(kind: TombstoneKind, ids: string[], now = Date.now()): Promise<void> {
  if (ids.length === 0) return;
  try {
    const existing = await loadTombstones(kind, now);
    const known = new Set(existing.map((t) => t.id));
    for (const id of ids) {
      if (!known.has(id)) existing.push({ id, deletedAt: now });
    }
    await AsyncStorage.setItem(KEY_PREFIX + kind, JSON.stringify(existing));
  } catch {
    /* best effort */
  }
}

/** Drop a tombstone once the deletion is confirmed everywhere (optional). */
export async function clearTombstone(kind: TombstoneKind, id: string): Promise<void> {
  try {
    const existing = await loadTombstones(kind);
    await AsyncStorage.setItem(KEY_PREFIX + kind, JSON.stringify(existing.filter((t) => t.id !== id)));
  } catch {
    /* best effort */
  }
}
