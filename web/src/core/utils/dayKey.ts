/**
 * Local-time day keys — the authoritative day boundary for anything that asks
 * "did this happen today?": habit streaks, decay eligibility, the daily
 * planning ritual, calendar heatmaps.
 *
 * A day key is a `YYYY-MM-DD` string built from a timestamp's LOCAL calendar
 * date (never UTC). This deliberately sidesteps the app's historical
 * client-local / server-UTC split: two events on the same wall-clock day
 * always share a key regardless of timezone or DST, and arithmetic on keys
 * goes through real Date objects so it stays DST-correct.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for the given date/timestamp in local time (defaults to now). */
export function toDayKey(input: Date | number = new Date()): string {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local day key. */
export function todayKey(): string {
  return toDayKey(new Date());
}

/** Parse a `YYYY-MM-DD` key back into a local-midnight Date. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Whole-day distance between two keys (b - a), DST-safe. */
export function daysBetweenKeys(a: string, b: string): number {
  const ms = fromDayKey(b).getTime() - fromDayKey(a).getTime();
  // Round rather than floor/truncate so a DST day (23h or 25h) still yields
  // an integer day count.
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of day keys from `a` to `b` (ascending). Empty if b < a. */
export function dayKeysBetween(a: string, b: string): string[] {
  const keys: string[] = [];
  const end = fromDayKey(b);
  const cur = fromDayKey(a);
  while (cur.getTime() <= end.getTime()) {
    keys.push(toDayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

/** The day key `n` days after `key` (n may be negative). */
export function addDaysToKey(key: string, n: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}
