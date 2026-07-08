/**
 * SocialContext (Phase C) — web-only, online-only.
 *
 * Friends and the weekly leaderboard are server-authoritative. We keep the last
 * successful snapshot in localStorage so the UI can show something ("as of …")
 * while offline, but we never compute leaderboards on the client.
 *
 * Also owns the invite deep-link spine reused by Phases D/E: a code captured
 * while logged-out is stashed as `pendingInviteCode` and redeemed on first login.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { usePreferences } from '../../app/PreferencesContext';
import { api } from '../../core/lib/api';
import { scheduleReminder } from '../../core/lib/notifications';
import type { Friend, LeaderboardRow, InviteKind, InviteResult } from './types';

const FRIENDS_KEY = 'tody:social:friends';
const LB_KEY = 'tody:social:leaderboard';
const LB_AT_KEY = 'tody:social:leaderboardAt';
const RANK_KEY = 'tody:social:lastRank';
const PENDING_INVITE_KEY = 'tody:pendingInviteCode';

/** Where invite links point. Uses the current origin so it works in any deploy. */
function inviteUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invite/${code}`;
}

function readJSON<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; }
  catch { return fallback; }
}
function writeJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export function setPendingInvite(code: string) {
  try { localStorage.setItem(PENDING_INVITE_KEY, code); } catch { /* ignore */ }
}
export function takePendingInvite(): string | null {
  try {
    const c = localStorage.getItem(PENDING_INVITE_KEY);
    if (c) localStorage.removeItem(PENDING_INVITE_KEY);
    return c;
  } catch { return null; }
}

interface SocialContextValue {
  friends: Friend[];
  leaderboard: LeaderboardRow[];
  leaderboardAt: number | null; // epoch ms of the cached snapshot
  isLoading: boolean;
  refresh: () => Promise<void>;
  createInvite: (kind?: InviteKind, targetId?: string) => Promise<InviteResult | null>;
  acceptInvite: (code: string) => Promise<{ ok: boolean; kind?: InviteKind; targetId?: string | null; error?: string }>;
  removeFriend: (friendId: string) => Promise<void>;
  myRank: number | null;
}

const SocialContext = createContext<SocialContextValue | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { webPrefs } = usePreferences();
  const [friends, setFriends] = useState<Friend[]>(() => readJSON<Friend[]>(FRIENDS_KEY, []));
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(() => readJSON<LeaderboardRow[]>(LB_KEY, []));
  const [leaderboardAt, setLeaderboardAt] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(LB_AT_KEY)); return v > 0 ? v : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const quiet = useMemo(
    () => ({ start: webPrefs.quietHoursStart ?? '', end: webPrefs.quietHoursEnd ?? '' }),
    [webPrefs.quietHoursStart, webPrefs.quietHoursEnd],
  );

  // Notify when a friend has overtaken you since the last snapshot.
  const maybeNotifyPassed = useCallback((rows: LeaderboardRow[]) => {
    if (!user) return;
    const me = rows.find((r) => r.is_self);
    if (!me) return;
    const prevRank = Number(localStorage.getItem(RANK_KEY)) || null;
    if (prevRank && me.rank > prevRank) {
      // Someone passed you: name the closest friend now ahead.
      const passer = rows.find((r) => !r.is_self && r.rank === me.rank - 1);
      const who = passer?.display_name ?? 'A friend';
      scheduleReminder(
        {
          id: 'social-passed',
          at: Date.now() + 800,
          title: `${who} passed you this week`,
          body: `You're #${me.rank} now — a few tasks could reclaim the lead.`,
          url: '/leaderboard',
        },
        quiet,
      );
    }
    localStorage.setItem(RANK_KEY, String(me.rank));
  }, [user, quiet]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const [fRes, lbRes] = await Promise.all([
      api.get<Friend[]>('/social/friends'),
      api.get<LeaderboardRow[]>('/social/leaderboard?period=week'),
    ]);
    if (Array.isArray(fRes.data)) {
      setFriends(fRes.data);
      writeJSON(FRIENDS_KEY, fRes.data);
    }
    if (Array.isArray(lbRes.data)) {
      setLeaderboard(lbRes.data);
      writeJSON(LB_KEY, lbRes.data);
      const now = Date.now();
      setLeaderboardAt(now);
      try { localStorage.setItem(LB_AT_KEY, String(now)); } catch { /* ignore */ }
      maybeNotifyPassed(lbRes.data);
    }
    setIsLoading(false);
  }, [user, maybeNotifyPassed]);

  // Refresh on login and on window focus (online-only; cached snapshot otherwise).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    if (loadedFor.current !== user.id) {
      loadedFor.current = user.id;
      void refresh();
    }
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refresh]);

  const createInvite = useCallback<SocialContextValue['createInvite']>(async (kind = 'friend', targetId) => {
    const { data, error } = await api.post<{ code: string; kind: InviteKind; expires_at: string }>(
      '/social/invites', { kind, target_id: targetId },
    );
    if (error || !data) return null;
    return { code: data.code, kind: data.kind, url: inviteUrl(data.code) };
  }, []);

  const acceptInvite = useCallback<SocialContextValue['acceptInvite']>(async (code) => {
    const { data, error, isBackendDown } = await api.post<{ ok: boolean; kind: InviteKind; target_id: string | null }>(
      `/social/invites/${code}/accept`,
    );
    if (isBackendDown) return { ok: false, error: 'offline' };
    if (error || !data) return { ok: false, error: error?.message ?? 'failed' };
    void refresh();
    return { ok: data.ok, kind: data.kind, targetId: data.target_id };
  }, [refresh]);

  const removeFriend = useCallback<SocialContextValue['removeFriend']>(async (friendId) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    await api.delete(`/social/friends/${friendId}`);
    void refresh();
  }, [refresh]);

  const myRank = useMemo(() => leaderboard.find((r) => r.is_self)?.rank ?? null, [leaderboard]);

  const value = useMemo<SocialContextValue>(() => ({
    friends, leaderboard, leaderboardAt, isLoading,
    refresh, createInvite, acceptInvite, removeFriend, myRank,
  }), [friends, leaderboard, leaderboardAt, isLoading, refresh, createInvite, acceptInvite, removeFriend, myRank]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialProvider');
  return ctx;
}
