import type { UserPreferences } from '../core/types';

/**
 * Preference-aware date/time formatting. The core `dateUtils.ts` hardcodes a
 * single US-ish format (and is byte-pinned to native, so it can't branch on
 * prefs); these helpers layer the user's `dateFormat` / `timeFormat` choices
 * on top for web surfaces that show absolute dates/times.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Absolute date honoring `prefs.dateFormat` (MM/DD/YYYY | DD/MM/YYYY | YYYY-MM-DD). */
export function formatDate(ts: number, prefs: Pick<UserPreferences, 'dateFormat'>): string {
  if (!ts || !isFinite(ts)) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  switch (prefs.dateFormat) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'MM/DD/YYYY':
    default: return `${mm}/${dd}/${yyyy}`;
  }
}

/** Clock time honoring `prefs.timeFormat` (12h → "3:05pm", 24h → "15:05"). */
export function formatClock(ts: number, prefs: Pick<UserPreferences, 'timeFormat'>): string {
  if (!ts || !isFinite(ts)) return '';
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  if (prefs.timeFormat === '24h') {
    return `${pad(h)}:${pad(m)}`;
  }
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${pad(m)}${period}`;
}
