/**
 * CollabContext (Phase D) — web-only.
 *
 * For the active workspace, tracks its members and (when the workspace is shared,
 * i.e. more than one member) opens a Supabase Realtime channel so other members'
 * task inserts/updates/deletes stream into TaskContext live. Personal and
 * single-member workspaces keep the pure offline model — no channel.
 *
 * Realtime rows are merged read-only via TaskContext.mergeRemoteTasks (LWW +
 * tombstones + a short echo guard). On (re)subscribe we do one direct fetch of
 * the workspace's tasks to heal any gap missed while disconnected.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { useTasks } from '../../core/context/TaskContext';
import { useWorkspaces } from '../workspaces/WorkspaceContext';
import { PERSONAL_WORKSPACE_ID } from '../workspaces/types';
import { api } from '../../core/lib/api';
import { supabase } from '../../core/lib/supabase';

export interface Member {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface CollabContextValue {
  /** Members of the active workspace (empty for Personal). */
  members: Member[];
  membersById: Record<string, Member>;
  /** True when the active workspace has more than one member. */
  isSharedWorkspace: boolean;
  /** Assign (or clear with null) a task to a member. Optimistic + server-stamped. */
  assignTask: (taskId: string, assigneeId: string | null) => Promise<void>;
  refreshMembers: () => void;
}

const CollabContext = createContext<CollabContextValue | undefined>(undefined);

export function CollabProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspaces();
  const { mergeRemoteTasks, applyRemoteDelete, updateTask } = useTasks();
  const [members, setMembers] = useState<Member[]>([]);

  const isPersonal = activeWorkspaceId === PERSONAL_WORKSPACE_ID;

  const refreshMembers = useCallback(() => {
    if (isPersonal) { setMembers([]); return; }
    api.get<Member[]>(`/workspaces/${activeWorkspaceId}/members`).then(({ data }) => {
      if (Array.isArray(data)) setMembers(data);
    });
  }, [activeWorkspaceId, isPersonal]);

  useEffect(() => { refreshMembers(); }, [refreshMembers]);

  const isSharedWorkspace = !isPersonal && members.length > 1;

  // Realtime channel — only for shared workspaces.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!user || !isSharedWorkspace) return;
    const wsId = activeWorkspaceId;

    const healGap = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', wsId)
        .is('deleted_at', null);
      if (Array.isArray(data) && data.length) void mergeRemoteTasks(data);
    };

    const channel = supabase
      .channel(`ws-tasks-${wsId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${wsId}` },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (id) applyRemoteDelete(id);
          } else if (payload.new) {
            // Soft-deleted rows arrive as UPDATE with deleted_at set.
            if (payload.new.deleted_at) applyRemoteDelete(payload.new.id);
            else void mergeRemoteTasks([payload.new]);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') void healGap();
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [user, isSharedWorkspace, activeWorkspaceId, mergeRemoteTasks, applyRemoteDelete]);

  const assignTask = useCallback(async (taskId: string, assigneeId: string | null) => {
    // Optimistic local update; the server stamps updated_at so its echo wins LWW.
    updateTask(taskId, { assigneeId });
    const { isBackendDown } = await api.post(`/tasks/${taskId}/assign`, { assignee_id: assigneeId });
    if (isBackendDown) {
      // Offline fallback: write assignee directly (RLS allows members). The
      // assignee trigger validates membership server-side.
      await supabase.from('tasks').update({ assignee_id: assigneeId, updated_at: new Date().toISOString() }).eq('id', taskId);
    }
  }, [updateTask]);

  const membersById = useMemo(() => {
    const m: Record<string, Member> = {};
    for (const mem of members) m[mem.id] = mem;
    return m;
  }, [members]);

  const value = useMemo<CollabContextValue>(() => ({
    members, membersById, isSharedWorkspace, assignTask, refreshMembers,
  }), [members, membersById, isSharedWorkspace, assignTask, refreshMembers]);

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be used within CollabProvider');
  return ctx;
}
