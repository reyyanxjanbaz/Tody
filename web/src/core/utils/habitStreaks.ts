import { addDaysToKey, daysBetweenKeys, fromDayKey, toDayKey } from './dayKey';
import type { Habit, HabitLog, HabitStreakInfo, WeekStart } from '../types/habits';
import { FREEZE_EARN_RUN, MAX_FREEZES } from '../types/habits';

/**
 * Phase 5 — pure habit-streak engine (classic streaks + freeze economy).
 *
 * Day boundaries are local 'YYYY-MM-DD' keys. Daily/weekdays streaks are
 * measured over DUE days (weekends never break a weekdays habit); x_per_week is
 * measured over weeks. `done` and `frozen` both keep a streak alive; a past due
 * day with no such log breaks it. Everything here is deterministic given a
 * `todayKey` + `weekStartsOn`, so it's fully unit-testable without a clock.
 */

type LogMap = Map<string, HabitLog['status']>;
const SAFE_ITER = 4000; // ~11yr guard on backward walks

/** Build a date→status lookup for one habit's logs. */
export function buildLogMap(logs: HabitLog[]): LogMap {
  const m: LogMap = new Map();
  for (const l of logs) m.set(l.date, l.status);
  return m;
}

const weekdayOf = (key: string): number => fromDayKey(key).getDay();
const isAlive = (s?: HabitLog['status']): boolean => s === 'done' || s === 'frozen';
const createdKeyOf = (habit: Habit): string => toDayKey(habit.createdAt);

/** Whether a completion on `key` counts toward this habit (per its schedule). */
export function isDueOn(habit: Habit, key: string): boolean {
  switch (habit.scheduleType) {
    case 'daily':
      return true;
    case 'weekdays': {
      const d = weekdayOf(key);
      return d >= 1 && d <= 5;
    }
    case 'x_per_week':
      // With day targeting, only those weekdays count; otherwise any day does.
      return habit.scheduleDays.length === 0 || habit.scheduleDays.includes(weekdayOf(key));
  }
}

// ── Week helpers (x_per_week) ────────────────────────────────────────────────

/** The day key of the week's start containing `key`, honoring weekStartsOn. */
export function weekStartKey(key: string, weekStartsOn: WeekStart): string {
  const start = weekStartsOn === 'monday' ? 1 : 0;
  const d = weekdayOf(key);
  const back = (d - start + 7) % 7;
  return addDaysToKey(key, -back);
}

function doneCountInWeek(map: LogMap, weekStart: string): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (map.get(addDaysToKey(weekStart, i)) === 'done' || map.get(addDaysToKey(weekStart, i)) === 'frozen') n++;
  }
  return n;
}

// ── Day-based streaks (daily / weekdays) ─────────────────────────────────────

function dayStreak(habit: Habit, map: LogMap, todayKey: string): number {
  const createdKey = createdKeyOf(habit);
  let streak = 0;
  let key = todayKey;

  // Today: if due & satisfied it extends the streak; if due & pending we don't
  // break (grace until day's end) and simply start counting from yesterday.
  if (isDueOn(habit, todayKey) && isAlive(map.get(todayKey))) streak++;
  key = addDaysToKey(todayKey, -1);

  for (let i = 0; i < SAFE_ITER; i++) {
    if (daysBetweenKeys(createdKey, key) < 0) break; // before the habit existed
    if (!isDueOn(habit, key)) { key = addDaysToKey(key, -1); continue; }
    if (isAlive(map.get(key))) { streak++; key = addDaysToKey(key, -1); }
    else break; // a missed past due day ends the streak
  }
  return streak;
}

function dayBestStreak(habit: Habit, map: LogMap, todayKey: string): number {
  const createdKey = createdKeyOf(habit);
  if (daysBetweenKeys(createdKey, todayKey) < 0) return 0;
  let best = 0, run = 0;
  let key = createdKey;
  for (let i = 0; i < SAFE_ITER && daysBetweenKeys(key, todayKey) >= 0; i++) {
    if (isDueOn(habit, key)) {
      if (isAlive(map.get(key))) { run++; if (run > best) best = run; }
      else if (key !== todayKey) run = 0; // past miss breaks; today-pending doesn't
    }
    key = addDaysToKey(key, 1);
  }
  return best;
}

function dayCompletionRate(habit: Habit, map: LogMap, todayKey: string): number {
  const createdKey = createdKeyOf(habit);
  if (daysBetweenKeys(createdKey, todayKey) < 0) return 0;
  let due = 0, done = 0;
  let key = createdKey;
  for (let i = 0; i < SAFE_ITER && daysBetweenKeys(key, todayKey) >= 0; i++) {
    if (isDueOn(habit, key) && key !== todayKey) { // exclude today (still in progress)
      due++;
      if (isAlive(map.get(key))) done++;
    }
    key = addDaysToKey(key, 1);
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

// ── Week-based streaks (x_per_week) ──────────────────────────────────────────

function weekStreak(habit: Habit, map: LogMap, todayKey: string, weekStartsOn: WeekStart): number {
  const target = Math.max(1, habit.scheduleTarget);
  const createdWeek = weekStartKey(createdKeyOf(habit), weekStartsOn);
  let streak = 0;
  let week = weekStartKey(todayKey, weekStartsOn);

  // Current week counts only if already satisfied; otherwise don't break.
  if (doneCountInWeek(map, week) >= target) streak++;
  week = addDaysToKey(week, -7);

  for (let i = 0; i < SAFE_ITER; i++) {
    if (daysBetweenKeys(createdWeek, week) < 0) break;
    if (doneCountInWeek(map, week) >= target) { streak++; week = addDaysToKey(week, -7); }
    else break;
  }
  return streak;
}

function weekBestStreak(habit: Habit, map: LogMap, todayKey: string, weekStartsOn: WeekStart): number {
  const target = Math.max(1, habit.scheduleTarget);
  const createdWeek = weekStartKey(createdKeyOf(habit), weekStartsOn);
  const thisWeek = weekStartKey(todayKey, weekStartsOn);
  let best = 0, run = 0;
  let week = createdWeek;
  for (let i = 0; i < SAFE_ITER && daysBetweenKeys(week, thisWeek) >= 0; i++) {
    const met = doneCountInWeek(map, week) >= target;
    if (met) { run++; if (run > best) best = run; }
    else if (week !== thisWeek) run = 0; // past unmet week breaks; current in-progress doesn't
    week = addDaysToKey(week, 7);
  }
  return best;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function computeStreakInfo(
  habit: Habit,
  logs: HabitLog[],
  todayKey: string,
  weekStartsOn: WeekStart,
): HabitStreakInfo {
  const map = buildLogMap(logs);

  if (habit.scheduleType === 'x_per_week') {
    const target = Math.max(1, habit.scheduleTarget);
    const week = weekStartKey(todayKey, weekStartsOn);
    const doneThisWeek = doneCountInWeek(map, week);
    const dueToday = isDueOn(habit, todayKey) && doneThisWeek < target && !isAlive(map.get(todayKey));
    return {
      current: weekStreak(habit, map, todayKey, weekStartsOn),
      best: weekBestStreak(habit, map, todayKey, weekStartsOn),
      dueToday,
      doneToday: isAlive(map.get(todayKey)),
      completionRate: weekCompletionRate(habit, map, todayKey, weekStartsOn),
    };
  }

  const dueToday = isDueOn(habit, todayKey);
  return {
    current: dayStreak(habit, map, todayKey),
    best: dayBestStreak(habit, map, todayKey),
    dueToday: dueToday && !isAlive(map.get(todayKey)),
    doneToday: isAlive(map.get(todayKey)),
    completionRate: dayCompletionRate(habit, map, todayKey),
  };
}

function weekCompletionRate(habit: Habit, map: LogMap, todayKey: string, weekStartsOn: WeekStart): number {
  const target = Math.max(1, habit.scheduleTarget);
  const createdWeek = weekStartKey(createdKeyOf(habit), weekStartsOn);
  const thisWeek = weekStartKey(todayKey, weekStartsOn);
  let weeks = 0, met = 0;
  let week = createdWeek;
  for (let i = 0; i < SAFE_ITER && daysBetweenKeys(week, thisWeek) > 0; i++) { // exclude current week
    weeks++;
    if (doneCountInWeek(map, week) >= target) met++;
    week = addDaysToKey(week, 7);
  }
  return weeks === 0 ? 0 : Math.round((met / weeks) * 100);
}

/**
 * True when extending a streak from `prev` to `next` crosses a freeze-earning
 * milestone (every FREEZE_EARN_RUN due-days). The context grants a freeze
 * (capped at MAX_FREEZES) when this returns true.
 */
export function earnsFreeze(prev: number, next: number): boolean {
  return next > prev && next % FREEZE_EARN_RUN === 0;
}

export interface RolloverResult {
  logs: HabitLog[];        // possibly with new 'frozen' entries appended
  freezes: number;         // possibly decremented
  saves: { habitId: string; date: string }[]; // freezes spent (for the "your ❄️ saved…" moment)
}

/**
 * Day-change rollover: for each active daily/weekdays habit, protect missed
 * PAST due days (between the habit's last activity and yesterday) with banked
 * freezes — oldest missed day first, until freezes run out. Once a miss can't
 * be covered, that habit's streak is allowed to break (we stop protecting it,
 * preserving remaining freezes for other days/habits). Pure: returns the new
 * logs + freeze count without mutating inputs.
 */
export function applyRollover(
  habits: Habit[],
  logs: HabitLog[],
  freezes: number,
  todayKey: string,
  now: number = Date.now(),
): RolloverResult {
  let remaining = freezes;
  const added: HabitLog[] = [];
  const saves: { habitId: string; date: string }[] = [];
  const byHabit = new Map<string, LogMap>();
  for (const l of logs) {
    let m = byHabit.get(l.habitId);
    if (!m) { m = new Map(); byHabit.set(l.habitId, m); }
    m.set(l.date, l.status);
  }

  for (const habit of habits) {
    if (habit.archivedAt || habit.deletedAt) continue;
    if (habit.scheduleType === 'x_per_week') continue; // week-based habits don't auto-freeze per day
    const map = byHabit.get(habit.id) ?? new Map();
    const createdKey = createdKeyOf(habit);

    // Only protect a streak that is currently alive (had a completion recently).
    // Walk from the day after the most recent alive log up to yesterday.
    let anchor: string | null = null;
    for (const [date, status] of map) {
      if ((status === 'done' || status === 'frozen') && (anchor === null || daysBetweenKeys(anchor, date) < 0)) {
        anchor = date;
      }
    }
    if (anchor === null) continue; // never completed → nothing to protect

    const yesterday = addDaysToKey(todayKey, -1);
    let key = anchor > createdKey ? anchor : createdKey;
    key = addDaysToKey(key, 1);
    while (daysBetweenKeys(key, yesterday) >= 0) {
      if (isDueOn(habit, key) && !isAlive(map.get(key))) {
        if (remaining > 0) {
          remaining--;
          map.set(key, 'frozen');
          added.push({ habitId: habit.id, date: key, status: 'frozen', completedAt: now });
          saves.push({ habitId: habit.id, date: key });
        } else {
          break; // can't protect → streak breaks here; keep remaining freezes
        }
      }
      key = addDaysToKey(key, 1);
    }
  }

  return { logs: added.length ? [...logs, ...added] : logs, freezes: remaining, saves };
}

/**
 * "Meta streak" — consecutive days on which EVERY day-based habit that was due
 * got done (or frozen). It's the whole-routine streak shown in the header.
 * x_per_week habits are ignored here (they aren't day-anchored). Today counts
 * only once all of today's due habits are satisfied; otherwise grace applies
 * and we count through yesterday.
 */
export function metaStreak(
  habits: Habit[],
  logs: HabitLog[],
  todayKey: string,
): number {
  const dayHabits = habits.filter((h) => !h.archivedAt && !h.deletedAt && h.scheduleType !== 'x_per_week');
  if (dayHabits.length === 0) return 0;

  const maps = new Map<string, LogMap>();
  for (const h of dayHabits) maps.set(h.id, new Map());
  for (const l of logs) maps.get(l.habitId)?.set(l.date, l.status);

  const earliestCreated = dayHabits.reduce((min, h) => Math.min(min, h.createdAt), Infinity);
  const floorKey = toDayKey(earliestCreated);

  // A day is "complete" if every habit due & already existing that day is alive.
  const dayComplete = (key: string): { due: boolean; complete: boolean } => {
    let anyDue = false, allDone = true;
    for (const h of dayHabits) {
      if (daysBetweenKeys(toDayKey(h.createdAt), key) < 0) continue; // not created yet
      if (!isDueOn(h, key)) continue;
      anyDue = true;
      if (!isAlive(maps.get(h.id)!.get(key))) allDone = false;
    }
    return { due: anyDue, complete: anyDue && allDone };
  };

  let streak = 0;
  let key = todayKey;
  const today = dayComplete(todayKey);
  if (today.due && today.complete) streak++;
  key = addDaysToKey(todayKey, -1);

  for (let i = 0; i < SAFE_ITER; i++) {
    if (daysBetweenKeys(floorKey, key) < 0) break;
    const day = dayComplete(key);
    if (!day.due) { key = addDaysToKey(key, -1); continue; } // no habits due → doesn't break
    if (day.complete) { streak++; key = addDaysToKey(key, -1); }
    else break;
  }
  return streak;
}

export { MAX_FREEZES };
