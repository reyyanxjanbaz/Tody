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
const NONE = new Set<string>();

/** Phase D — the Realtime echo guard, now keyed on an EXPLICIT locally-mutated
 *  set (fix M1). This is the load-bearing correctness of collaborative editing
 *  against an offline-first store. */
describe('Phase D — selectMergeableRemote (explicit echo guard + LWW)', () => {
  it('applies a genuinely newer remote change to an untouched task', () => {
    const local = [t('a', NOW - 60_000)];
    const remote = [t('a', NOW - 30_000, { title: 'from-friend' })];
    const out = selectMergeableRemote(local, remote, NONE, NONE);
    expect(out.find((x) => x.id === 'a')!.title).toBe('from-friend');
  });

  it('skips the echo of a task the local user just mutated (in mutatedIds)', () => {
    const local = [t('a', NOW - 1000, { title: 'my-latest-edit' })];
    const remote = [t('a', NOW + 2000, { title: 'stale-echo' })];
    const out = selectMergeableRemote(local, remote, NONE, new Set(['a']));
    expect(out.find((x) => x.id === 'a')!.title).toBe('my-latest-edit');
  });

  it('does NOT throttle rapid successive REMOTE edits (the M1 regression)', () => {
    // A task freshly merged from remote is NOT in mutatedIds, so a second remote
    // edit to it lands immediately (the old updatedAt-proxy dropped it).
    const local = [t('a', NOW, { title: 'remote-edit-1' })]; // just merged, updatedAt≈now
    const remote = [t('a', NOW + 1000, { title: 'remote-edit-2' })];
    const out = selectMergeableRemote(local, remote, NONE, NONE);
    expect(out.find((x) => x.id === 'a')!.title).toBe('remote-edit-2');
  });

  it('still accepts a brand-new remote task even during a local edit burst', () => {
    const local = [t('a', NOW - 500)];
    const remote = [t('b', NOW - 10_000, { title: 'new-shared-task' })];
    const out = selectMergeableRemote(local, remote, NONE, new Set(['a']));
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('never resurrects a tombstoned task, even if remote is newer', () => {
    const local = [t('a', NOW - 60_000)];
    const remote = [t('a', NOW), t('gone', NOW)];
    const out = selectMergeableRemote(local, remote, new Set(['gone']), NONE);
    expect(out.some((x) => x.id === 'gone')).toBe(false);
  });

  it('drops a tombstoned task already present locally', () => {
    const local = [t('a', NOW - 60_000), t('zombie', NOW - 60_000)];
    const out = selectMergeableRemote(local, [], new Set(['zombie']), NONE);
    expect(out.some((x) => x.id === 'zombie')).toBe(false);
  });
});
