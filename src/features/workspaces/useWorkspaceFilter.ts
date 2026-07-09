/**
 * useWorkspaceFilter (Phase B) — the single place list data is scoped to the
 * active workspace. Every screen that renders tasks/categories/habits/inbox must
 * pipe its list through `filterByWorkspace` so nothing leaks across workspaces.
 *
 * A row belongs to the active workspace when its `workspaceId` matches, treating
 * NULL/undefined as the implicit Personal workspace.
 */
import { useCallback } from 'react';
import { useWorkspaces } from './WorkspaceContext';
import { PERSONAL_WORKSPACE_ID } from './types';

type HasWorkspace = { workspaceId?: string | null };

/** Pure predicate — exported for unit testing. */
export function belongsToWorkspace(
  item: HasWorkspace,
  activeWorkspaceId: string,
): boolean {
  const rowId = item.workspaceId ?? PERSONAL_WORKSPACE_ID;
  return rowId === activeWorkspaceId;
}

/** Pure filter — exported for unit testing. */
export function filterByWorkspace<T extends HasWorkspace>(
  items: T[],
  activeWorkspaceId: string,
): T[] {
  return items.filter((it) => belongsToWorkspace(it, activeWorkspaceId));
}

/** Hook binding the pure filter to the active workspace. */
export function useWorkspaceFilter() {
  const { activeWorkspaceId } = useWorkspaces();
  const filter = useCallback(
    <T extends HasWorkspace>(items: T[]) => filterByWorkspace(items, activeWorkspaceId),
    [activeWorkspaceId],
  );
  return { activeWorkspaceId, filter };
}
