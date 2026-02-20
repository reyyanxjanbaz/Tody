/**
 * Profile Statistics & Gamification Engine
 *
 * XP, level-up calculations and calendar data.
 * All computations are pure — no side effects.
 *
 * NOTE: calculateStreaks() and calculateProfileStats() have been removed.
 * Streak and stats data now come from the Render backend via
 *   GET /profile/analytics  (streaks, distribution, daily trend)
 *   GET /profile/stats      (totals, completion %, time invested)
 * in ProfileScreen.tsx.
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

export function calculateXP(tasks: Task[], currentStreak: number): XPData {
  let totalXP = 0;

  for (const t of tasks) {
    if (!t.isCompleted || !t.completedAt) continue;
    totalXP += XP_PER_TASK;

    // Bonus: had a time estimate
    if (t.estimatedMinutes != null && t.estimatedMinutes > 0) {
      totalXP += XP_BONUS_ESTIMATED;
    }

    // Bonus: completed on or before deadline
    if (t.deadline && t.completedAt <= t.deadline) {
      totalXP += XP_BONUS_ON_TIME;
    }
  }

  // Streak bonus
  totalXP += currentStreak * XP_PER_STREAK_DAY;

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

    // Tasks whose deadline falls on this day OR were completed on this day
    let total = 0;
    let completed = 0;

    for (const t of tasks) {
      const belongsToDay =
        (t.deadline && dayKey(t.deadline) === dk) ||
        (t.completedAt && dayKey(t.completedAt) === dk);

      if (belongsToDay) {
        total++;
        if (t.isCompleted) completed++;
      }
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
