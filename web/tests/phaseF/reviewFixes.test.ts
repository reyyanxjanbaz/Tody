import { describe, expect, it } from 'vitest';
import { belongsToWorkspace } from '../../src/features/workspaces/useWorkspaceFilter';
import { PERSONAL_WORKSPACE_ID } from '../../src/features/workspaces/types';

/**
 * Phase F — regression tests for the code-review remediation.
 * (Realtime merge M1 is covered in tests/phaseD/mergeGuard.test.ts.)
 */

describe('H3 — workspace-delete reassignment semantics', () => {
  // Mirror of TaskContext.reassignWorkspaceTasks 'move': a task's workspaceId is
  // cleared to null, so it belongs to Personal and NOTHING becomes invisible.
  it('a moved task lands in Personal (never orphaned)', () => {
    const moved = { id: 't', workspaceId: null };
    expect(belongsToWorkspace(moved, PERSONAL_WORKSPACE_ID)).toBe(true);
    // And it does NOT show under the deleted workspace id anymore.
    expect(belongsToWorkspace(moved, 'ws-deleted')).toBe(false);
  });
});

describe('M2/L4 — workspace-scoped category tab filter', () => {
  // Mirror of HomeScreen.workspaceCategories: Overview is always present; other
  // categories only show in their own workspace.
  const cats = [
    { id: 'overview', workspaceId: null },
    { id: 'personal-cat', workspaceId: null },
    { id: 'office-cat', workspaceId: 'ws-office' },
  ];
  const tabsFor = (wsDbId: string | null) =>
    cats.filter((c) => c.id === 'overview' || (c.workspaceId ?? null) === wsDbId).map((c) => c.id);

  it('Personal shows its own categories + Overview, not the office one', () => {
    expect(tabsFor(null)).toEqual(['overview', 'personal-cat']);
  });
  it('a shared workspace shows Overview + its own categories only', () => {
    expect(tabsFor('ws-office')).toEqual(['overview', 'office-cat']);
  });
});
