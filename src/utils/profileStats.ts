/**
 * Profile Statistics & Gamification Engine
 *
 * Calculates streaks, XP, levels, calendar data, and productivity metrics
 * from the task corpus. All computations are pure — no side effects.
 */

import { Task, ProfileStats, DayTaskStatus, XPData } from '../types';
import { startOfDay } from './dateUtils';

// ── XP Constants ────────────────────────────────────────────────────────────

const XP_PER_TASK = 10;
const XP_BONUS_ESTIMATED = 5; // bonus for tasks that had time estimates
const XP_BONUS_ON_TIME = 8; // completed before or on deadline
const XP_PER_STREAK_DAY = 3; // bonus per streak day (applied once to current streak)
const XP_PER_LEVEL = 120;

// ── Day helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Streak Calculation ──────────────────────────────────────────────────────

/**
 * Calculate current and best streaks.
 * A streak day is any calendar day where at least one task was completed.
 */
export function calculateStreaks(tasks: Task[]): { current: number; best: number } {
  const completedDays = new Set<string>();
  for (const t of tasks) {
    if (t.isCompleted && t.completedAt) {
      completedDays.add(dayKey(t.completedAt));
    }
  }

  if (completedDays.size === 0) return { current: 0, best: 0 };

  // Build sorted array of unique days
  const sorted = Array.from(completedDays).sort();
  const dayTimestamps = sorted.map(s => startOfDay(new Date(s)).getTime());

  // Walk backwards from today
  const todayTs = startOfDay().getTime();
  let current = 0;
  let checkTs = todayTs;

  // Allow today or yesterday as streak start
  if (completedDays.has(dayKey(todayTs))) {
    current = 1;
    checkTs = todayTs - DAY_MS;
  } else if (completedDays.has(dayKey(todayTs - DAY_MS))) {
    current = 1;
    checkTs = todayTs - 2 * DAY_MS;
  } else {
    return { current: 0, best: calcBest(dayTimestamps) };
  }

  while (completedDays.has(dayKey(checkTs))) {
    current++;
    checkTs -= DAY_MS;
  }

  return { current, best: Math.max(current, calcBest(dayTimestamps)) };
}

function calcBest(sortedDayTs: number[]): number {
  if (sortedDayTs.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDayTs.length; i++) {
    const diff = sortedDayTs[i] - sortedDayTs[i - 1];
    if (diff <= DAY_MS + 1000) { // tolerance for DST
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
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

// ── Full Profile Stats ──────────────────────────────────────────────────────

export function calculateProfileStats(tasks: Task[]): ProfileStats {
  const totalCreated = tasks.length;
  const totalCompleted = tasks.filter(t => t.isCompleted).length;
  const totalIncomplete = totalCreated - totalCompleted;
  const completionPercentage = totalCreated > 0
    ? Math.round((totalCompleted / totalCreated) * 100)
    : 0;

  const { current: currentStreak, best: bestStreak } = calculateStreaks(tasks);

  // Average tasks per day (days that have at least one task)
  const activeDays = new Set<string>();
  for (const t of tasks) {
    if (t.completedAt) activeDays.add(dayKey(t.completedAt));
    if (t.createdAt) activeDays.add(dayKey(t.createdAt));
  }
  const averageTasksPerDay = activeDays.size > 0
    ? Math.round((totalCreated / activeDays.size) * 10) / 10
    : 0;

  // Time stats
  const tasksWithActual = tasks.filter(
    t => t.isCompleted && t.actualMinutes != null && t.actualMinutes > 0,
  );
  const totalMinutesSpent = tasksWithActual.reduce(
    (sum, t) => sum + (t.actualMinutes || 0), 0,
  );
  const averageMinutesPerTask = tasksWithActual.length > 0
    ? Math.round(totalMinutesSpent / tasksWithActual.length)
    : 0;

  // Most productive day of the week (by completions)
  const dayCountMap = new Array(7).fill(0);
  for (const t of tasks) {
    if (t.isCompleted && t.completedAt) {
      const dow = new Date(t.completedAt).getDay();
      dayCountMap[dow]++;
    }
  }
  const maxDayCount = Math.max(...dayCountMap);
  const mostProductiveDay = maxDayCount > 0
    ? DAY_LABELS[dayCountMap.indexOf(maxDayCount)]
    : '—';

  return {
    totalCreated,
    totalCompleted,
    totalIncomplete,
    completionPercentage,
    currentStreak,
    bestStreak,
    averageTasksPerDay,
    totalMinutesSpent,
    averageMinutesPerTask,
    mostProductiveDay,
  };
}
