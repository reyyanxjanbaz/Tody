import { describe, expect, it } from 'vitest';
import { addDaysToKey, toDayKey } from '../../src/core/utils/dayKey';
import {
  applyRollover,
  computeStreakInfo,
  earnsFreeze,
  isDueOn,
  metaStreak,
  weekStartKey,
} from '../../src/core/utils/habitStreaks';
import type { Habit, HabitLog } from '../../src/core/types/habits';
import { DEFAULT_HABIT } from '../../src/core/types/habits';

// A fixed "today". 2026-03-16 is a Monday.
const TODAY = '2026-03-16';
const createdAt = new Date(2025, 0, 1).getTime(); // long ago so it never bounds our windows

function mkHabit(over: Partial<Habit> = {}): Habit {
  return { ...DEFAULT_HABIT, id: 'h1', createdAt, updatedAt: createdAt, ...over };
}

const doneOn = (keys: string[], habitId = 'h1'): HabitLog[] =>
  keys.map((date) => ({ habitId, date, status: 'done' as const, completedAt: 0 }));

/** N consecutive day keys ending at (and including) `end`. */
const lastNDays = (end: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => addDaysToKey(end, -(n - 1 - i)));

describe('Phase 5 — isDueOn', () => {
  it('daily is due every day', () => {
    expect(isDueOn(mkHabit(), '2026-03-14')).toBe(true);
    expect(isDueOn(mkHabit(), '2026-03-15')).toBe(true); // Sunday
  });

  it('weekdays is due Mon–Fri only', () => {
    const h = mkHabit({ scheduleType: 'weekdays' });
    expect(isDueOn(h, '2026-03-16')).toBe(true);  // Mon
    expect(isDueOn(h, '2026-03-20')).toBe(true);  // Fri
    expect(isDueOn(h, '2026-03-21')).toBe(false); // Sat
    expect(isDueOn(h, '2026-03-22')).toBe(false); // Sun
  });
});

describe('Phase 5 — daily streaks', () => {
  it('counts consecutive done days including today', () => {
    const logs = doneOn(lastNDays(TODAY, 5));
    expect(computeStreakInfo(mkHabit(), logs, TODAY, 'sunday').current).toBe(5);
  });

  it("today still pending does not break — counts through yesterday", () => {
    const logs = doneOn(lastNDays(addDaysToKey(TODAY, -1), 4)); // done for 4 days up to yesterday
    const info = computeStreakInfo(mkHabit(), logs, TODAY, 'sunday');
    expect(info.current).toBe(4);
    expect(info.dueToday).toBe(true);
    expect(info.doneToday).toBe(false);
  });

  it('a gap in the past breaks the streak', () => {
    // done today, yesterday, then a MISS two days ago, then done before that
    const logs = doneOn([TODAY, addDaysToKey(TODAY, -1), addDaysToKey(TODAY, -3), addDaysToKey(TODAY, -4)]);
    expect(computeStreakInfo(mkHabit(), logs, TODAY, 'sunday').current).toBe(2);
  });

  it('frozen days keep the streak alive', () => {
    const logs: HabitLog[] = [
      { habitId: 'h1', date: TODAY, status: 'done', completedAt: 0 },
      { habitId: 'h1', date: addDaysToKey(TODAY, -1), status: 'frozen', completedAt: 0 },
      { habitId: 'h1', date: addDaysToKey(TODAY, -2), status: 'done', completedAt: 0 },
    ];
    expect(computeStreakInfo(mkHabit(), logs, TODAY, 'sunday').current).toBe(3);
  });

  it('reports best streak across history', () => {
    // a 3-run, gap, then a 2-run ending yesterday (today pending)
    const logs = doneOn([
      addDaysToKey(TODAY, -8), addDaysToKey(TODAY, -7), addDaysToKey(TODAY, -6), // 3-run
      addDaysToKey(TODAY, -1), addDaysToKey(TODAY, -2),                          // 2-run
    ]);
    expect(computeStreakInfo(mkHabit(), logs, TODAY, 'sunday').best).toBe(3);
  });

  it('completion rate excludes today and is a percentage of due days', () => {
    // habit created 4 days ago; done on 2 of the 3 past due days
    const h = mkHabit({ createdAt: new Date(fromKey(addDaysToKey(TODAY, -3))).getTime() });
    const logs = doneOn([addDaysToKey(TODAY, -3), addDaysToKey(TODAY, -1)]);
    expect(computeStreakInfo(h, logs, TODAY, 'sunday').completionRate).toBe(67);
  });
});

describe('Phase 5 — weekdays streaks', () => {
  it('a weekend gap does not break the streak', () => {
    // Fri 2026-03-13 done, Sat/Sun off, Mon 2026-03-16 (today) done
    const logs = doneOn(['2026-03-13', TODAY]);
    const info = computeStreakInfo(mkHabit({ scheduleType: 'weekdays' }), logs, TODAY, 'sunday');
    expect(info.current).toBe(2);
  });

  it('a missed weekday DOES break the streak', () => {
    // Thu missed, Fri + Mon done → streak only Fri..Mon = 2
    const logs = doneOn(['2026-03-13', TODAY]); // Fri + Mon, Thu (03-12) missing
    // add an earlier done Wed to prove the Thu gap caps it
    logs.push(...doneOn(['2026-03-11']));
    expect(computeStreakInfo(mkHabit({ scheduleType: 'weekdays' }), logs, TODAY, 'sunday').current).toBe(2);
  });
});

describe('Phase 5 — x_per_week streaks', () => {
  const h = mkHabit({ scheduleType: 'x_per_week', scheduleTarget: 3 });

  it('weekStartKey honors weekStartsOn', () => {
    expect(weekStartKey('2026-03-16', 'monday')).toBe('2026-03-16'); // Mon
    expect(weekStartKey('2026-03-16', 'sunday')).toBe('2026-03-15'); // prev Sun
  });

  it('counts weeks that met the target', () => {
    // this week (Mon-based) has 3 done → satisfied; prior week 3 done → satisfied
    const logs = doneOn([
      '2026-03-16', '2026-03-17', '2026-03-18',                 // this week
      '2026-03-09', '2026-03-10', '2026-03-11',                 // last week
    ]);
    expect(computeStreakInfo(h, logs, TODAY, 'monday').current).toBe(2);
  });

  it('a week under target breaks the week-streak', () => {
    const logs = doneOn([
      '2026-03-16', '2026-03-17', '2026-03-18', // this week ok
      '2026-03-09',                              // last week only 1 (< 3)
      '2026-03-02', '2026-03-03', '2026-03-04',  // week before ok
    ]);
    expect(computeStreakInfo(h, logs, TODAY, 'monday').current).toBe(1);
  });
});

describe('Phase 5 — freeze economy', () => {
  it('earnsFreeze on crossing a 7-day multiple while growing', () => {
    expect(earnsFreeze(6, 7)).toBe(true);
    expect(earnsFreeze(7, 8)).toBe(false);
    expect(earnsFreeze(13, 14)).toBe(true);
    expect(earnsFreeze(8, 7)).toBe(false); // shrinking
  });

  it('applyRollover spends one freeze to protect a single missed day', () => {
    // done through 2 days ago; yesterday missed; today pending
    const logs = doneOn([addDaysToKey(TODAY, -2), addDaysToKey(TODAY, -3)]);
    const res = applyRollover([mkHabit()], logs, 1, TODAY);
    expect(res.freezes).toBe(0);
    expect(res.saves).toHaveLength(1);
    // the frozen day keeps the streak alive up to yesterday
    expect(computeStreakInfo(mkHabit(), res.logs, TODAY, 'sunday').current).toBe(3);
  });

  it('applyRollover stops protecting once freezes run out (streak breaks)', () => {
    // two missed days, only one freeze → the older gets frozen, the newer stays missed
    const logs = doneOn([addDaysToKey(TODAY, -3), addDaysToKey(TODAY, -4)]);
    const res = applyRollover([mkHabit()], logs, 1, TODAY);
    expect(res.freezes).toBe(0);
    // streak is broken (yesterday still missing) → current 0 (today pending, no recent alive run)
    expect(computeStreakInfo(mkHabit(), res.logs, TODAY, 'sunday').current).toBe(0);
  });

  it('applyRollover leaves x_per_week habits untouched', () => {
    const wk = mkHabit({ id: 'w', scheduleType: 'x_per_week', scheduleTarget: 3 });
    const res = applyRollover([wk], [], 2, TODAY);
    expect(res.freezes).toBe(2);
    expect(res.logs).toHaveLength(0);
  });
});

describe('Phase 5 — meta streak (whole routine)', () => {
  it('counts days where every due habit was done', () => {
    const a = mkHabit({ id: 'a' });
    const b = mkHabit({ id: 'b' });
    // both done today, yesterday, day-before → 3
    const days = lastNDays(TODAY, 3);
    const logs = [...doneOn(days, 'a'), ...doneOn(days, 'b')];
    expect(metaStreak([a, b], logs, TODAY)).toBe(3);
  });

  it('breaks when one habit missed a due day', () => {
    const a = mkHabit({ id: 'a' });
    const b = mkHabit({ id: 'b' });
    const days = lastNDays(TODAY, 3);
    // b missed two days ago
    const logs = [...doneOn(days, 'a'), ...doneOn([days[0], days[2]], 'b')];
    expect(metaStreak([a, b], logs, TODAY)).toBe(1);
  });

  it('today still pending does not break the meta streak (grace)', () => {
    const a = mkHabit({ id: 'a' });
    const days = lastNDays(addDaysToKey(TODAY, -1), 2); // done through yesterday
    expect(metaStreak([a], doneOn(days, 'a'), TODAY)).toBe(2);
  });
});

// helper: dayKey → Date-ish start-of-day timestamp for createdAt
function fromKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// silence unused import lint if toDayKey isn't referenced elsewhere
void toDayKey;
