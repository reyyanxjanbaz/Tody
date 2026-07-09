/**
 * Profile Statistics & Gamification Engine
 *
 * XP, level-up calculations and monthly calendar data.
 * All computations are pure — no side effects.
 *
 * Streaks and aggregate stats are served by the Render backend:
 *   GET /profile/analytics  — streaks, distribution, daily trend
 *   GET /profile/stats      — totals, completion %, time invested
 * See ProfileScreen.tsx for the fetch logic.
 */

import { Task, DayTaskStatus, XPData } from '../types';

// ── XP Constants ────────────────────────────────────────────────────────────

const XP_PER_TASK = 10;
const XP_BONUS_ESTIMATED = 5; // bonus for tasks that had time estimates
const XP_BONUS_ON_TIME = 8; // completed before or on deadline
const XP_PER_STREAK_DAY = 3; // bonus per streak day (applied once to current streak)
const XP_PER_LEVEL = 120;

// ── Day helpers ─────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── XP / Level ──────────────────────────────────────────────────────────────

/**
 * Streak-bonus days derived from completion HISTORY rather than the live
 * streak. Every day that belongs to a run of >= 2 consecutive completion days
 * banks XP permanently. This makes total XP monotonic: missing a day (breaking
 * the *current* streak) can never erase past runs, so XP/level never drop.
 * (The old formula added `liveStreak * 3` to the grand total, so a streak reset
 * to 0 instantly removed XP and could drop the user a level.)
 */
function bankedStreakDays(completionDayKeys: string[]): number {
  const days = [...new Set(completionDayKeys)].sort();
  if (days.length === 0) return 0;

  let banked = 0;
  let runLen = 1;
  const flushRun = () => { if (runLen >= 2) banked += runLen; };

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (gap === 1) {
      runLen++;
    } else {
      flushRun();
      runLen = 1;
    }
  }
  flushRun();
  return banked;
}

/**
 * @param tasks     all of the user's tasks (active + archived)
 * @param _streak   deprecated — retained for call-site compatibility; ignored
 *                  (the streak bonus is now history-derived, see bankedStreakDays)
 * @param extraXP   additional XP from other sources (e.g. habit completions)
 */
export function calculateXP(tasks: Task[], _streak = 0, extraXP = 0): XPData {
  let totalXP = extraXP;
  const completionDayKeys: string[] = [];

  for (const t of tasks) {
    if (!t.isCompleted || !t.completedAt) continue;
    totalXP += XP_PER_TASK;
    completionDayKeys.push(dayKey(t.completedAt));

    // Bonus: had a time estimate
    if (t.estimatedMinutes != null && t.estimatedMinutes > 0) {
      totalXP += XP_BONUS_ESTIMATED;
    }

    // Bonus: completed on or before deadline
    if (t.deadline && t.completedAt <= t.deadline) {
      totalXP += XP_BONUS_ON_TIME;
    }
  }

  // Banked (history-derived, monotonic) streak bonus
  totalXP += bankedStreakDays(completionDayKeys) * XP_PER_STREAK_DAY;

  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = totalXP % XP_PER_LEVEL;
  const progressPercent = Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100);

  return {
    totalXP,
    level,
    xpInCurrentLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progressPercent,
  };
}

// ── Monthly Calendar Data ───────────────────────────────────────────────────

export function getMonthCalendarData(
  tasks: Task[],
  year: number,
  month: number, // 0-indexed
): DayTaskStatus[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: DayTaskStatus[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
    const dk = dayKey(dayStart);

    // Each task belongs to exactly ONE day: its completion day if completed,
    // otherwise its deadline day. (Previously a late-completed task was counted
    // on both its deadline day AND its completion day, inflating totals.)
    let total = 0;
    let completed = 0;

    for (const t of tasks) {
      const anchor = t.isCompleted && t.completedAt ? t.completedAt : t.deadline;
      if (!anchor) continue;
      if (dayKey(anchor) !== dk) continue;
      total++;
      if (t.isCompleted) completed++;
    }

    result.push({
      date: dayStart,
      total,
      completed,
      allDone: total > 0 && completed === total,
      hasIncomplete: total > 0 && completed < total,
    });
  }

  return result;
}
