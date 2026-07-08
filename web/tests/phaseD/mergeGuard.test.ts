import { describe, expect, it } from 'vitest';
import { selectMergeableRemote } from '../../src/core/context/TaskContext';
import type { Task } from '../../src/core/types';

function t(id: string, updatedAt: number, extra: Partial<Task> = {}): Task {
  return {
    id, title: id, description: '', createdAt: 0, updatedAt, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: false, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 0, childIds: [], depth: 0, ...extra,
  };
}

const NOW = 1_000_000_000_000;
const GUARD = 5000;
const NO_TOMBSTONES = new Set<string>();

/** Phase D — the Realtime echo guard. This is the load-bearing correctness of
 *  collaborative editing against an offline-first store. */
describe('Phase D — selectMergeableRemote (echo guard + LWW)', () => {
  it('applies a genuinely newer remote change to an untouched task', () => {
    const local = [t('a', NOW - 60_000)]; // last touched a minute ago (not guarded)
    const remote = [t('a', NOW - 30_000, { title: 'from-friend' })];
    const out = selectMergeableRemote(local, remote, NO_TOMBSTONES, NOW, GUARD);
    expect(out.find((x) => x.id === 'a')!.title).toBe('from-friend');
  });

  it('skips the echo of a task the local user just mutated (clock-skew safe)', () => {
    // Local edited 1s ago (within guard). The server echo carries a LATER
    // updatedAt (skew) but an OLDER state — plain LWW would clobber; the guard
    // keeps the local copy.
    const local = [t('a', NOW - 1000, { title: 'my-latest-edit' })];
    const remote = [t('a', NOW + 2000, { title: 'stale-echo' })];
    const out = selectMergeableRemote(local, remote, NO_TOMBSTONES, NOW, GUARD);
    expect(out.find((x) => x.id === 'a')!.title).toBe('my-latest-edit');
  });

  it('still accepts a brand-new remote task even during a local edit burst', () => {
    const local = [t('a', NOW - 500)]; // guarded, but unrelated
    const remote = [t('b', NOW - 10_000, { title: 'new-shared-task' })];
    const out = selectMergeableRemote(local, remote, NO_TOMBSTONES, NOW, GUARD);
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('never resurrects a tombstoned task, even if remote is newer', () => {
    const local = [t('a', NOW - 60_000)];
    const remote = [t('a', NOW), t('gone', NOW)];
    const out = selectMergeableRemote(local, remote, new Set(['gone']), NOW, GUARD);
    expect(out.some((x) => x.id === 'gone')).toBe(false);
  });

  it('drops a tombstoned task already present locally', () => {
    const local = [t('a', NOW - 60_000), t('zombie', NOW - 60_000)];
    const out = selectMergeableRemote(local, [], new Set(['zombie']), NOW, GUARD);
    expect(out.some((x) => x.id === 'zombie')).toBe(false);
  });
});
