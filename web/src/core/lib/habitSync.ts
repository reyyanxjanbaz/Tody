import { supabase } from './supabase';
import { api } from './api';
import type { Habit, HabitLog } from '../types/habits';

/**
 * Phase 5 — habit cloud sync. Mirrors the task dual-path pattern (FastAPI first,
 * direct Supabase fallback) but stays entirely best-effort: every call is
 * wrapped so a backend/DB that isn't reachable never surfaces to the UI. The
 * client's localStorage is authoritative for offline use; this just mirrors.
 */

function toISO(epoch: number | null | undefined): string | null {
  if (epoch == null) return null;
  return new Date(epoch).toISOString();
}
function fromISO(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : 0;
}

// ── Row mappers ──────────────────────────────────────────────────────────────

export function habitToRow(h: Habit, userId: string) {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    icon: h.icon,
    color: h.color,
    schedule_type: h.scheduleType,
    schedule_days: h.scheduleDays,
    schedule_target: h.scheduleTarget,
    time_of_day: h.timeOfDay,
    energy_level: h.energyLevel,
    tiny_version: h.tinyVersion,
    reminder_time: h.reminderTime,
    order: h.order,
    workspace_id: h.workspaceId ?? null,
    created_at: toISO(h.createdAt),
    updated_at: toISO(h.updatedAt),
    archived_at: toISO(h.archivedAt),
    deleted_at: toISO(h.deletedAt),
  };
}

export function rowToHabit(r: any): Habit {
  return {
    id: r.id,
    name: r.name ?? '',
    icon: r.icon ?? 'flame-outline',
    color: r.color ?? '#F59E0B',
    scheduleType: r.schedule_type ?? 'daily',
    scheduleDays: r.schedule_days ?? [],
    scheduleTarget: r.schedule_target ?? 1,
    timeOfDay: r.time_of_day ?? 'anytime',
    energyLevel: r.energy_level ?? 'medium',
    tinyVersion: r.tiny_version ?? '',
    reminderTime: r.reminder_time ?? null,
    order: r.order ?? 0,
    createdAt: fromISO(r.created_at),
    updatedAt: fromISO(r.updated_at),
    archivedAt: r.archived_at ? fromISO(r.archived_at) : null,
    deletedAt: r.deleted_at ? fromISO(r.deleted_at) : null,
    workspaceId: r.workspace_id ?? null,
    userId: r.user_id,
  };
}

export function logToRow(l: HabitLog, userId: string) {
  return {
    user_id: userId,
    habit_id: l.habitId,
    date: l.date,
    status: l.status,
    completed_at: toISO(l.completedAt),
  };
}

export function rowToLog(r: any): HabitLog {
  return {
    habitId: r.habit_id,
    date: r.date,
    status: r.status ?? 'done',
    completedAt: fromISO(r.completed_at),
  };
}

// ── Pull ─────────────────────────────────────────────────────────────────────

export async function fetchHabits(): Promise<{ habits: Habit[]; logs: HabitLog[] } | null> {
  try {
    // FastAPI first.
    const { data, error, isBackendDown } = await api.get<{ habits: any[]; logs: any[] }>('/habits');
    if (!error && !isBackendDown && data) {
      return {
        habits: (data.habits ?? []).filter((r) => !r.deleted_at).map(rowToHabit),
        logs: (data.logs ?? []).map(rowToLog),
      };
    }
  } catch { /* fall through to supabase */ }

  try {
    const [{ data: hRows }, { data: lRows }] = await Promise.all([
      supabase.from('habits').select('*').is('deleted_at', null),
      supabase.from('habit_logs').select('*'),
    ]);
    if (!hRows) return null;
    return { habits: hRows.map(rowToHabit), logs: (lRows ?? []).map(rowToLog) };
  } catch {
    return null;
  }
}

// ── Push (best-effort) ───────────────────────────────────────────────────────

export async function upsertHabit(habit: Habit, userId: string): Promise<void> {
  try {
    const { error, isBackendDown } = await api.post('/habits', habitToRow(habit, userId));
    if (!error && !isBackendDown) return;
  } catch { /* fall through */ }
  try { await supabase.from('habits').upsert(habitToRow(habit, userId)); } catch { /* best-effort */ }
}

export async function deleteHabitFromDb(id: string): Promise<void> {
  const deleted_at = new Date().toISOString();
  try {
    const { error, isBackendDown } = await api.delete(`/habits/${id}`);
    if (!error && !isBackendDown) return;
  } catch { /* fall through */ }
  try {
    const { error } = await supabase.from('habits').update({ deleted_at, updated_at: deleted_at }).eq('id', id);
    if (error) await supabase.from('habits').delete().eq('id', id); // pre-migration fallback
  } catch { /* best-effort */ }
}

export async function upsertHabitLog(log: HabitLog, userId: string): Promise<void> {
  try {
    const { error, isBackendDown } = await api.put(`/habits/${log.habitId}/logs/${log.date}`, {
      status: log.status, completed_at: toISO(log.completedAt),
    });
    if (!error && !isBackendDown) return;
  } catch { /* fall through */ }
  try {
    await supabase.from('habit_logs').upsert(logToRow(log, userId), { onConflict: 'habit_id,date' });
  } catch { /* best-effort */ }
}

export async function deleteHabitLog(habitId: string, date: string): Promise<void> {
  try {
    const { error, isBackendDown } = await api.delete(`/habits/${habitId}/logs/${date}`);
    if (!error && !isBackendDown) return;
  } catch { /* fall through */ }
  try { await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', date); } catch { /* best-effort */ }
}
