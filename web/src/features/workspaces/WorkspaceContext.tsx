/**
 * WorkspaceContext (Phase B) — web-only.
 *
 * Owns the list of named workspaces and the currently active one. Switching is a
 * pure local state change (instant) — screens filter their own data through
 * `useWorkspaceFilter`; nothing is refetched.
 *
 * Data authority: workspace definitions are server-authoritative but cached in
 * localStorage for offline reads. Loading strategy mirrors the rest of the app:
 *   localStorage cache → GET /workspaces (Render) → direct Supabase fallback.
 * Writes are optimistic-local with a client-generated UUID, pushed to the
 * backend (Supabase fallback when the backend is down) so a workspace can be
 * created offline and reconciles on reconnect.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import type { ReactNode } from 'react';
import { generateId } from '../../core/utils/id';
import { useAuth } from '../../core/context/AuthContext';
import { api } from '../../core/lib/api';
import { supabase } from '../../core/lib/supabase';
import {
  type Workspace,
  PERSONAL_WORKSPACE,
  PERSONAL_WORKSPACE_ID,
} from './types';

const CACHE_KEY = 'tody:workspaces';
const ACTIVE_KEY = 'tody:activeWorkspace';

interface DbWorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  icon: string;
  accent: string | null;
  is_default: boolean;
  sort_order: number;
  deleted_at?: string | null;
}

function rowToWorkspace(r: DbWorkspaceRow): Workspace {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    accent: r.accent,
    isDefault: r.is_default,
    sortOrder: r.sort_order,
  };
}

function readCache(): Workspace[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Workspace[]) : [];
  } catch {
    return [];
  }
}

function writeCache(list: Workspace[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

interface WorkspaceContextValue {
  /** All workspaces incl. the synthetic Personal at index 0, sorted. */
  workspaces: Workspace[];
  /** Named (non-Personal) workspaces only. */
  namedWorkspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace;
  isLoading: boolean;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (partial: { name: string; icon?: string; accent?: string | null }) => Workspace;
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'icon' | 'accent'>>) => void;
  deleteWorkspace: (id: string) => void;
  reorderWorkspaces: (orderedIds: string[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [named, setNamed] = useState<Workspace[]>(() => readCache());
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || PERSONAL_WORKSPACE_ID; }
    catch { return PERSONAL_WORKSPACE_ID; }
  });

  // Persist named workspaces to the offline cache whenever they change.
  useEffect(() => { writeCache(named); }, [named]);

  // Persist the active selection.
  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, activeWorkspaceId); } catch { /* ignore */ }
  }, [activeWorkspaceId]);

  // Load from the server (cache is already showing) once authenticated.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;

    let cancelled = false;
    (async () => {
      const { data, isBackendDown } = await api.get<DbWorkspaceRow[]>('/workspaces');
      // Guard against non-array payloads (404 error body, backend not yet
      // deployed, etc.) so we never call .map on a non-array.
      let rows: DbWorkspaceRow[] | null = Array.isArray(data) ? data : null;
      if (isBackendDown || !rows) {
        // Fallback: direct Supabase (RLS scopes to workspaces the user belongs to).
        // If the table doesn't exist yet (migration not applied), this errors and
        // res.data is null — we simply keep the cached list.
        const res = await supabase
          .from('workspaces')
          .select('*')
          .is('deleted_at', null)
          .order('sort_order');
        rows = Array.isArray(res.data) ? (res.data as DbWorkspaceRow[]) : null;
      }
      if (cancelled) return;
      if (rows) setNamed(rows.map(rowToWorkspace));
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const setActiveWorkspace = useCallback((id: string) => setActiveWorkspaceId(id), []);

  const addWorkspace = useCallback<WorkspaceContextValue['addWorkspace']>((partial) => {
    const ws: Workspace = {
      id: generateId(),
      name: partial.name.trim(),
      icon: partial.icon ?? 'albums-outline',
      accent: partial.accent ?? null,
      isDefault: false,
      sortOrder: named.length,
    };
    setNamed((prev) => [...prev, ws]);
    // Push (backend → Supabase fallback). Client-generated UUID upserts safely.
    (async () => {
      const body = {
        id: ws.id, name: ws.name, icon: ws.icon,
        accent: ws.accent, sort_order: ws.sortOrder,
      };
      const { isBackendDown } = await api.post('/workspaces', body);
      if (isBackendDown && user) {
        await supabase.from('workspaces').upsert(
          { ...body, owner_id: user.id },
          { onConflict: 'id' },
        );
      }
    })();
    return ws;
  }, [named.length, user]);

  const updateWorkspace = useCallback<WorkspaceContextValue['updateWorkspace']>((id, updates) => {
    if (id === PERSONAL_WORKSPACE_ID) return; // Personal is synthetic
    setNamed((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    (async () => {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name;
      if (updates.icon !== undefined) body.icon = updates.icon;
      if (updates.accent !== undefined) body.accent = updates.accent;
      const { isBackendDown } = await api.patch(`/workspaces/${id}`, body);
      if (isBackendDown) {
        await supabase.from('workspaces').update(body).eq('id', id);
      }
    })();
  }, []);

  const deleteWorkspace = useCallback<WorkspaceContextValue['deleteWorkspace']>((id) => {
    if (id === PERSONAL_WORKSPACE_ID) return;
    setNamed((prev) => prev.filter((w) => w.id !== id));
    // If the deleted workspace was active, fall back to Personal.
    setActiveWorkspaceId((cur) => (cur === id ? PERSONAL_WORKSPACE_ID : cur));
    (async () => {
      const { isBackendDown } = await api.delete(`/workspaces/${id}`);
      if (isBackendDown) {
        await supabase.from('workspaces').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      }
    })();
  }, []);

  const reorderWorkspaces = useCallback<WorkspaceContextValue['reorderWorkspaces']>((orderedIds) => {
    setNamed((prev) => {
      const byId = new Map(prev.map((w) => [w.id, w]));
      const next = orderedIds
        .map((id, i) => { const w = byId.get(id); return w ? { ...w, sortOrder: i } : null; })
        .filter((w): w is Workspace => w !== null);
      // Keep any workspace not present in orderedIds appended (defensive).
      for (const w of prev) if (!orderedIds.includes(w.id)) next.push(w);
      return next;
    });
    (async () => {
      const { isBackendDown } = await api.post('/workspaces/reorder', { ordered_ids: orderedIds });
      if (isBackendDown) {
        await Promise.all(orderedIds.map((id, i) =>
          supabase.from('workspaces').update({ sort_order: i }).eq('id', id)));
      }
    })();
  }, []);

  const namedSorted = useMemo(
    () => [...named].sort((a, b) => a.sortOrder - b.sortOrder),
    [named],
  );
  const workspaces = useMemo(
    () => [PERSONAL_WORKSPACE, ...namedSorted],
    [namedSorted],
  );
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? PERSONAL_WORKSPACE,
    [workspaces, activeWorkspaceId],
  );

  // If the active workspace vanished (deleted on another device), reset to Personal.
  useEffect(() => {
    if (activeWorkspaceId !== PERSONAL_WORKSPACE_ID &&
        !namedSorted.some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(PERSONAL_WORKSPACE_ID);
    }
  }, [namedSorted, activeWorkspaceId]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces,
    namedWorkspaces: namedSorted,
    activeWorkspaceId,
    activeWorkspace,
    isLoading,
    setActiveWorkspace,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    reorderWorkspaces,
  }), [
    workspaces, namedSorted, activeWorkspaceId, activeWorkspace, isLoading,
    setActiveWorkspace, addWorkspace, updateWorkspace, deleteWorkspace, reorderWorkspaces,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaces(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaces must be used within WorkspaceProvider');
  return ctx;
}
