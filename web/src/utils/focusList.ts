import { todayKey } from '../core/utils/dayKey';

/**
 * Phase 6.2 — the day's chosen top-3 (task ids), picked in the Planning Ritual
 * and consumed by Focus mode. Scoped per local day so it resets each morning.
 */
const key = (day: string) => `tody:focusList:${day}`;

export function getFocusList(day: string = todayKey()): string[] {
  try {
    const raw = localStorage.getItem(key(day));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setFocusList(ids: string[], day: string = todayKey()): void {
  try { localStorage.setItem(key(day), JSON.stringify(ids.slice(0, 3))); } catch { /* ignore */ }
}
