/**
 * Workspaces (Phase B) — web-only feature types.
 *
 * A workspace groups tasks/categories/habits/inbox captures. Every user has an
 * implicit "Personal" workspace represented by `PERSONAL_WORKSPACE_ID` (the
 * client sentinel) which maps to a NULL `workspace_id` in the database. Named
 * workspaces are rows in the `workspaces` table.
 */

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  accent?: string | null;
  isDefault: boolean;
  sortOrder: number;
}

/** Sentinel id for the implicit Personal workspace (DB workspace_id = NULL). */
export const PERSONAL_WORKSPACE_ID = 'personal';

/** The synthetic Personal workspace shown first in every switcher. */
export const PERSONAL_WORKSPACE: Workspace = {
  id: PERSONAL_WORKSPACE_ID,
  name: 'Personal',
  icon: 'person-outline',
  accent: null,
  isDefault: true,
  sortOrder: -1,
};

/** The `workspace_id` value written to rows for a given active workspace.
 *  Personal → null (the implicit workspace). */
export function workspaceIdForDb(activeWorkspaceId: string): string | null {
  return activeWorkspaceId === PERSONAL_WORKSPACE_ID ? null : activeWorkspaceId;
}

/** The local workspace id a row belongs to. NULL/undefined → Personal. */
export function workspaceIdFromRow(rowWorkspaceId: string | null | undefined): string {
  return rowWorkspaceId ?? PERSONAL_WORKSPACE_ID;
}
