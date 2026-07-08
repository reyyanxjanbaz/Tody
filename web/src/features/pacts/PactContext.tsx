/**
 * PactContext (Phase E) — web-only, server-authoritative.
 *
 * Pacts are NOT tasks; they live entirely here. We fetch on login/focus, keep a
 * localStorage cache for offline reads, and subscribe to Realtime on the pact
 * tables (RLS scopes events to the caller's pacts) to refresh on any change.
 *
 * Completing your part is an ONLINE-required action — the quorum ("everyone
 * done") is decided by a server RPC, so we don't fake it offline. When a pact
 * flips to `completed`, every connected participant sees confetti.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { useCelebration } from '../../components/Celebration';
import { api } from '../../core/lib/api';
import { supabase } from '../../core/lib/supabase';
import type { Pact } from './types';

const CACHE_KEY = 'tody:pacts';

function readCache(): Pact[] {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? (JSON.parse(r) as Pact[]) : []; }
  catch { return []; }
}

interface PactContextValue {
  pacts: Pact[];
  activePacts: Pact[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  getPact: (id: string) => Pact | undefined;
  createPact: (input: { title: string; description?: string; deadline?: string | null }) => Promise<Pact | null>;
  completeMyPart: (pactId: string) => Promise<{ ok: boolean; error?: string }>;
  acceptPact: (pactId: string) => Promise<void>;
  declinePact: (pactId: string) => Promise<void>;
  leavePact: (pactId: string) => Promise<void>;
  cancelPact: (pactId: string) => Promise<void>;
}

const PactContext = createContext<PactContextValue | undefined>(undefined);

export function PactProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { celebrate } = useCelebration();
  const [pacts, setPacts] = useState<Pact[]>(() => readCache());
  const [isLoading, setIsLoading] = useState(false);
  const prevStatus = useRef<Map<string, string>>(new Map());
  const celebratedRef = useRef<Set<string>>(new Set()); // pact ids already celebrated (L7 dedupe)

  // Fire confetti when a pact newly becomes completed (for everyone connected).
  // Deduped by pact id so patch() + the Realtime refetch can't double-fire.
  const detectCompletions = useCallback((next: Pact[]) => {
    let celebrated = false;
    for (const p of next) {
      const before = prevStatus.current.get(p.id);
      const newlyDone = before && before !== 'completed' && p.status === 'completed';
      if (newlyDone && !celebratedRef.current.has(p.id) && !celebrated) {
        celebratedRef.current.add(p.id);
        celebrate(window.innerWidth / 2, window.innerHeight / 3);
        celebrated = true;
      }
    }
    prevStatus.current = new Map(next.map((p) => [p.id, p.status]));
  }, [celebrate]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await api.get<Pact[]>('/pacts');
    if (Array.isArray(data)) {
      // Seed prevStatus on first load so we don't celebrate already-completed pacts.
      if (prevStatus.current.size === 0) {
        prevStatus.current = new Map(data.map((p) => [p.id, p.status]));
      } else {
        detectCompletions(data);
      }
      setPacts(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, [user, detectCompletions]);

  // Load on login + on focus (focus throttled to once / 30s — fix L5).
  const loadedFor = useRef<string | null>(null);
  const lastFocusRefresh = useRef(0);
  useEffect(() => {
    if (!user) return;
    if (loadedFor.current !== user.id) { loadedFor.current = user.id; void refresh(); }
    const onFocus = () => {
      if (Date.now() - lastFocusRefresh.current < 30_000) return;
      lastFocusRefresh.current = Date.now();
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refresh]);

  // Realtime: any change to my pacts (RLS-scoped) → refetch, debounced so a burst
  // of participant updates coalesces into one fetch (L7).
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 500);
    };
    const channel = supabase
      .channel('pacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacts' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pact_participants' }, debouncedRefresh)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [user, refresh]);

  const patch = useCallback((updated: Pact | null) => {
    if (!updated) return;
    setPacts((prev) => {
      const next = prev.some((p) => p.id === updated.id)
        ? prev.map((p) => (p.id === updated.id ? updated : p))
        : [updated, ...prev];
      detectCompletions(next);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [detectCompletions]);

  const createPact = useCallback<PactContextValue['createPact']>(async (input) => {
    const { data } = await api.post<Pact>('/pacts', {
      title: input.title, description: input.description ?? '', deadline: input.deadline ?? null,
    });
    if (data) patch(data);
    return data ?? null;
  }, [patch]);

  const completeMyPart = useCallback<PactContextValue['completeMyPart']>(async (pactId) => {
    const { data, error, isBackendDown } = await api.post<Pact>(`/pacts/${pactId}/done`);
    if (isBackendDown) return { ok: false, error: 'offline' };
    if (error) return { ok: false, error: error.message };
    patch(data);
    return { ok: true };
  }, [patch]);

  const lifecycle = useCallback(async (pactId: string, action: 'accept' | 'decline' | 'leave' | 'cancel') => {
    if (action === 'cancel') { await api.delete(`/pacts/${pactId}`); void refresh(); return; }
    const { data } = await api.post<Pact>(`/pacts/${pactId}/${action}`);
    patch(data);
  }, [patch, refresh]);

  const value = useMemo<PactContextValue>(() => ({
    pacts,
    activePacts: pacts.filter((p) => p.status === 'active'),
    isLoading,
    refresh,
    getPact: (id) => pacts.find((p) => p.id === id),
    createPact,
    completeMyPart,
    acceptPact: (id) => lifecycle(id, 'accept'),
    declinePact: (id) => lifecycle(id, 'decline'),
    leavePact: (id) => lifecycle(id, 'leave'),
    cancelPact: (id) => lifecycle(id, 'cancel'),
  }), [pacts, isLoading, refresh, createPact, completeMyPart, lifecycle]);

  return <PactContext.Provider value={value}>{children}</PactContext.Provider>;
}

export function usePacts(): PactContextValue {
  const ctx = useContext(PactContext);
  if (!ctx) throw new Error('usePacts must be used within PactProvider');
  return ctx;
}
