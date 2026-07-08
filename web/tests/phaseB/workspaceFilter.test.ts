import { describe, expect, it } from 'vitest';
import {
  belongsToWorkspace,
  filterByWorkspace,
} from '../../src/features/workspaces/useWorkspaceFilter';
import {
  PERSONAL_WORKSPACE_ID,
  workspaceIdForDb,
  workspaceIdFromRow,
} from '../../src/features/workspaces/types';

/** Phase B — the workspace scoping predicate is the single guard against data
 *  leaking across workspaces, so pin its NULL/Personal semantics precisely. */
describe('Phase B — workspace filtering', () => {
  const personalRow = { id: 'a', workspaceId: null };
  const undefRow = { id: 'b' }; // legacy row, no workspaceId at all
  const officeRow = { id: 'c', workspaceId: 'ws-office' };

  it('treats null and undefined workspaceId as Personal', () => {
    expect(belongsToWorkspace(personalRow, PERSONAL_WORKSPACE_ID)).toBe(true);
    expect(belongsToWorkspace(undefRow, PERSONAL_WORKSPACE_ID)).toBe(true);
    expect(belongsToWorkspace(officeRow, PERSONAL_WORKSPACE_ID)).toBe(false);
  });

  it('matches a named workspace only for its own rows', () => {
    expect(belongsToWorkspace(officeRow, 'ws-office')).toBe(true);
    expect(belongsToWorkspace(personalRow, 'ws-office')).toBe(false);
    expect(belongsToWorkspace(undefRow, 'ws-office')).toBe(false);
  });

  it('filterByWorkspace partitions a mixed list without leaks', () => {
    const items = [personalRow, undefRow, officeRow];
    expect(filterByWorkspace(items, PERSONAL_WORKSPACE_ID)).toEqual([personalRow, undefRow]);
    expect(filterByWorkspace(items, 'ws-office')).toEqual([officeRow]);
    expect(filterByWorkspace(items, 'ws-empty')).toEqual([]);
  });

  it('maps the active workspace id to the DB value (Personal → null)', () => {
    expect(workspaceIdForDb(PERSONAL_WORKSPACE_ID)).toBeNull();
    expect(workspaceIdForDb('ws-office')).toBe('ws-office');
  });

  it('maps a DB row value back to a local workspace id (null → Personal)', () => {
    expect(workspaceIdFromRow(null)).toBe(PERSONAL_WORKSPACE_ID);
    expect(workspaceIdFromRow(undefined)).toBe(PERSONAL_WORKSPACE_ID);
    expect(workspaceIdFromRow('ws-office')).toBe('ws-office');
  });

  it('round-trips: a row stamped for a workspace filters back into it', () => {
    for (const active of [PERSONAL_WORKSPACE_ID, 'ws-office', 'ws-home']) {
      const stamped = { id: 'x', workspaceId: workspaceIdForDb(active) };
      expect(belongsToWorkspace(stamped, active)).toBe(true);
    }
  });
});
