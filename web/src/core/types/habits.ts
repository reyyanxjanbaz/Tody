import type { EnergyLevel } from './index';

/**
 * Phase 5 — Habit tracker (classic streaks). All NEW types (kept out of the
 * byte-identical `core/types/index.ts`). Day boundaries use local 'YYYY-MM-DD'
 * day keys (see core/utils/dayKey) — the client owns local-day semantics.
 */

/** Mirrors UserPreferences['weekStartsOn'] (kept local to avoid importing it). */
export type WeekStart = 'sunday' | 'monday';

export type HabitScheduleType =
  | 'daily'       // due every day
  | 'weekdays'    // due Mon–Fri (weekends are off, never break the streak)
  | 'x_per_week'; // due N times within a week (streak measured in weeks)

export type HabitTimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

export type HabitLogStatus = 'done' | 'skipped' | 'frozen';

export interface Habit {
  id: string;
  name: string;
  icon: string;            // Ionicons kebab name (via iconRegistry)
  color: string;           // hex accent
  scheduleType: HabitScheduleType;
  scheduleDays: number[];  // 0=Sun..6=Sat — optional targeting for x_per_week (empty = any day)
  scheduleTarget: number;  // for x_per_week: times per week (else 1)
  timeOfDay: HabitTimeOfDay;
  energyLevel: EnergyLevel;
  tinyVersion: string;     // "just do the minimum" fallback text ('' if none)
  reminderTime: string | null; // 'HH:MM' local, or null
  order: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
  userId?: string;
}

export interface HabitLog {
  habitId: string;
  date: string;            // local day key 'YYYY-MM-DD'
  status: HabitLogStatus;
  completedAt: number;     // client-supplied timestamp of the action
}

/** Per-habit streak summary derived by the pure engine. */
export interface HabitStreakInfo {
  current: number;
  best: number;
  /** Whether the habit is due today and not yet satisfied. */
  dueToday: boolean;
  /** Whether today's obligation is already satisfied (done or frozen). */
  doneToday: boolean;
  /** Completion rate over the habit's due days so far (0–100). */
  completionRate: number;
}

export const DEFAULT_HABIT: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  icon: 'flame-outline',
  color: '#F59E0B',
  scheduleType: 'daily',
  scheduleDays: [],
  scheduleTarget: 1,
  timeOfDay: 'anytime',
  energyLevel: 'medium',
  tinyVersion: '',
  reminderTime: null,
  order: 0,
  archivedAt: null,
  deletedAt: null,
};

/** Max streak-freezes a user can bank (classic Duolingo cap). */
export const MAX_FREEZES = 2;

/** A completed run of this many due-days earns one freeze. */
export const FREEZE_EARN_RUN = 7;
