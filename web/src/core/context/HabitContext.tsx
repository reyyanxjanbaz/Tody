import {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/id';
import { todayKey } from '../utils/dayKey';
import { useAuth } from './AuthContext';
import { usePreferences } from '../../app/PreferencesContext';
import type { Habit, HabitLog, HabitStreakInfo, WeekStart } from '../types/habits';
import { DEFAULT_HABIT, MAX_FREEZES } from '../types/habits';
import { computeStreakInfo, earnsFreeze, applyRollover } from '../utils/habitStreaks';
import {
  fetchHabits, upsertHabit, deleteHabitFromDb, upsertHabitLog, deleteHabitLog,
} from '../lib/habitSync';
import { scheduleReminder, clearReminder, nextClockTime, permissionState } from '../lib/notifications';

const HKEY = 'tody:habits';
const LKEY = 'tody:habitLogs';
const FKEY = 'tody:habitFreezes';
const ROLLKEY = 'tody:habitRolloverDay';
const MILESTONES = [7, 30, 100];
const XP_PER_LOG = 5;

export interface ToggleResult {
  done: boolean;
  streak: number;
  milestone: number | null; // 7 | 30 | 100 when just reached
  freezeEarned: boolean;
}

interface HabitContextValue {
  habits: Habit[];            // active (non-archived, non-deleted), order-sorted
  archivedHabits: Habit[];
  logs: HabitLog[];
  freezes: number;
  isLoading: boolean;
  addHabit: (partial: Partial<Habit>) => Habit;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  archiveHabit: (id: string, archived?: boolean) => void;
  reorderHabits: (orderedIds: string[]) => void;
  toggleHabit: (habitId: string, date?: string) => ToggleResult;
  getStreakInfo: (habitId: string) => HabitStreakInfo;
  getHabit: (id: string) => Habit | undefined;
  logsFor: (habitId: string) => HabitLog[];
  habitXP: number;
}

const HabitContext = createContext<HabitContextValue | undefined>(undefined);

const isActive = (h: Habit) => !h.deletedAt && !h.archivedAt;
const logKey = (habitId: string, date: string) => `${habitId}|${date}`;

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { prefs, webPrefs } = usePreferences();
  const weekStartsOn: WeekStart = prefs.weekStartsOn;

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [freezes, setFreezes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const habitsRef = useRef<Habit[]>([]);
  const logsRef = useRef<HabitLog[]>([]);
  const freezesRef = useRef(0);
  habitsRef.current = habits;
  logsRef.current = logs;
  freezesRef.current = freezes;

  // ── Load + day-rollover ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [h, l, f] = await Promise.all([
          AsyncStorage.getItem(HKEY), AsyncStorage.getItem(LKEY), AsyncStorage.getItem(FKEY),
        ]);
        let loadedHabits: Habit[] = h ? JSON.parse(h) : [];
        let loadedLogs: HabitLog[] = l ? JSON.parse(l) : [];
        let loadedFreezes = f ? Number(f) || 0 : 0;

        // Day-change rollover: protect missed days with banked freezes.
        const roll = applyRollover(loadedHabits, loadedLogs, loadedFreezes, todayKey());
        loadedLogs = roll.logs;
        loadedFreezes = roll.freezes;

        setHabits(loadedHabits);
        setLogs(loadedLogs);
        setFreezes(loadedFreezes);
        if (roll.saves.length) {
          AsyncStorage.setItem(LKEY, JSON.stringify(loadedLogs)).catch(() => {});
          AsyncStorage.setItem(FKEY, String(loadedFreezes)).catch(() => {});
        }
        AsyncStorage.setItem(ROLLKEY, todayKey()).catch(() => {});
      } catch { /* start empty */ }
      setIsLoading(false);
    })();
  }, []);

  // ── Best-effort cloud pull (newest-wins on habits by updatedAt) ─────────────
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!user || isLoading || syncedRef.current) return;
    syncedRef.current = true;
    (async () => {
      const remote = await fetchHabits();
      if (!remote) return;
      setHabits((local) => mergeHabits(local, remote.habits));
      setLogs((local) => mergeLogs(local, remote.logs));
    })();
  }, [user, isLoading]);

  // ── Persist (debounced) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => { AsyncStorage.setItem(HKEY, JSON.stringify(habits)).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [habits, isLoading]);
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => { AsyncStorage.setItem(LKEY, JSON.stringify(logs)).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [logs, isLoading]);
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(FKEY, String(freezes)).catch(() => {});
  }, [freezes, isLoading]);

  // ── Habit reminders (P6.1) — schedule while the app is open ─────────────────
  useEffect(() => {
    if (isLoading || permissionState() !== 'granted') return;
    const quiet = { start: webPrefs.quietHoursStart, end: webPrefs.quietHoursEnd };
    const active = habits.filter(isActive);
    for (const h of active) {
      const rid = `habit:${h.id}`;
      const info = computeStreakInfo(h, logs.filter((l) => l.habitId === h.id), todayKey(), weekStartsOn);
      if (h.reminderTime && info.dueToday) {
        scheduleReminder({ id: rid, at: nextClockTime(h.reminderTime), title: `⏰ ${h.name}`, body: h.tinyVersion ? `Even the tiny version counts: ${h.tinyVersion}` : 'Keep your streak alive today.', url: '/habits' }, quiet);
      } else {
        clearReminder(rid);
      }
    }
  }, [habits, logs, isLoading, webPrefs.quietHoursStart, webPrefs.quietHoursEnd, weekStartsOn]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const addHabit = useCallback((partial: Partial<Habit>): Habit => {
    const now = Date.now();
    const maxOrder = habitsRef.current.reduce((m, h) => Math.max(m, h.order), -1);
    const habit: Habit = {
      ...DEFAULT_HABIT, ...partial,
      id: generateId(), createdAt: now, updatedAt: now,
      order: partial.order ?? maxOrder + 1, userId: user?.id,
    };
    setHabits((prev) => [...prev, habit]);
    if (user) upsertHabit(habit, user.id).catch(() => {});
    return habit;
  }, [user]);

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => {
      if (h.id !== id) return h;
      const merged = { ...h, ...updates, updatedAt: Date.now() };
      if (user) upsertHabit(merged, user.id).catch(() => {});
      return merged;
    }));
  }, [user]);

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, deletedAt: Date.now(), updatedAt: Date.now() } : h)));
    deleteHabitFromDb(id).catch(() => {});
  }, []);

  const archiveHabit = useCallback((id: string, archived = true) => {
    updateHabit(id, { archivedAt: archived ? Date.now() : null });
  }, [updateHabit]);

  const reorderHabits = useCallback((orderedIds: string[]) => {
    setHabits((prev) => prev.map((h) => {
      const idx = orderedIds.indexOf(h.id);
      return idx >= 0 ? { ...h, order: idx, updatedAt: Date.now() } : h;
    }));
    // best-effort cloud order push
    if (user) {
      const uid = user.id;
      orderedIds.forEach((id, idx) => {
        const h = habitsRef.current.find((x) => x.id === id);
        if (h) upsertHabit({ ...h, order: idx }, uid).catch(() => {});
      });
    }
  }, [user]);

  // ── Toggle a day's log (optimistic) ─────────────────────────────────────────
  const toggleHabit = useCallback((habitId: string, date: string = todayKey()): ToggleResult => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit) return { done: false, streak: 0, milestone: null, freezeEarned: false };

    const existing = logsRef.current.find((l) => l.habitId === habitId && l.date === date);
    const prevInfo = computeStreakInfo(habit, logsRef.current.filter((l) => l.habitId === habitId), todayKey(), weekStartsOn);

    if (existing && existing.status === 'done') {
      // Undo → remove the log.
      const nextLogs = logsRef.current.filter((l) => !(l.habitId === habitId && l.date === date));
      setLogs(nextLogs);
      deleteHabitLog(habitId, date).catch(() => {});
      const info = computeStreakInfo(habit, nextLogs.filter((l) => l.habitId === habitId), todayKey(), weekStartsOn);
      return { done: false, streak: info.current, milestone: null, freezeEarned: false };
    }

    // Mark done.
    const newLog: HabitLog = { habitId, date, status: 'done', completedAt: Date.now() };
    const nextLogs = [...logsRef.current.filter((l) => !(l.habitId === habitId && l.date === date)), newLog];
    setLogs(nextLogs);
    if (user) upsertHabitLog(newLog, user.id).catch(() => {});

    const info = computeStreakInfo(habit, nextLogs.filter((l) => l.habitId === habitId), todayKey(), weekStartsOn);

    // Freeze economy: earn one on crossing a 7-day milestone (capped).
    let freezeEarned = false;
    if (earnsFreeze(prevInfo.current, info.current) && freezesRef.current < MAX_FREEZES) {
      freezeEarned = true;
      setFreezes((f) => Math.min(MAX_FREEZES, f + 1));
    }

    const milestone = MILESTONES.includes(info.current) && info.current > prevInfo.current ? info.current : null;
    return { done: true, streak: info.current, milestone, freezeEarned };
  }, [user, weekStartsOn]);

  const getStreakInfo = useCallback((habitId: string): HabitStreakInfo => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit) return { current: 0, best: 0, dueToday: false, doneToday: false, completionRate: 0 };
    return computeStreakInfo(habit, logsRef.current.filter((l) => l.habitId === habitId), todayKey(), weekStartsOn);
  }, [weekStartsOn]);

  const getHabit = useCallback((id: string) => habitsRef.current.find((h) => h.id === id), []);
  const logsFor = useCallback((habitId: string) => logs.filter((l) => l.habitId === habitId), [logs]);

  const activeHabits = useMemo(() => habits.filter(isActive).sort((a, b) => a.order - b.order), [habits]);
  const archivedHabits = useMemo(() => habits.filter((h) => h.archivedAt && !h.deletedAt), [habits]);
  const habitXP = useMemo(() => logs.filter((l) => l.status === 'done').length * XP_PER_LOG, [logs]);

  const value = useMemo<HabitContextValue>(() => ({
    habits: activeHabits, archivedHabits, logs, freezes, isLoading,
    addHabit, updateHabit, deleteHabit, archiveHabit, reorderHabits,
    toggleHabit, getStreakInfo, getHabit, logsFor, habitXP,
  }), [activeHabits, archivedHabits, logs, freezes, isLoading, addHabit, updateHabit, deleteHabit, archiveHabit, reorderHabits, toggleHabit, getStreakInfo, getHabit, logsFor, habitXP]);

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
}

export function useHabits(): HabitContextValue {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error('useHabits must be used within HabitProvider');
  return ctx;
}

// ── Merge helpers (newest-wins) ──────────────────────────────────────────────

function mergeHabits(local: Habit[], remote: Habit[]): Habit[] {
  const byId = new Map(local.map((h) => [h.id, h]));
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || r.updatedAt >= l.updatedAt) byId.set(r.id, r);
  }
  return [...byId.values()];
}

function mergeLogs(local: HabitLog[], remote: HabitLog[]): HabitLog[] {
  const byKey = new Map(local.map((l) => [logKey(l.habitId, l.date), l]));
  for (const r of remote) {
    const k = logKey(r.habitId, r.date);
    const l = byKey.get(k);
    if (!l || r.completedAt >= l.completedAt) byKey.set(k, r);
  }
  return [...byKey.values()];
}
