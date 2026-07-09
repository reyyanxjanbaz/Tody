/**
 * Phase 6.1 — PWA-honest local notifications.
 *
 * We do NOT run a push server. Instead, while the app is open (or recently
 * active), an in-page timer registry fires reminders via the service worker's
 * showNotification(). Permission is only ever requested from an explicit user
 * action in Settings — never on load. A quiet-hours window suppresses reminders
 * overnight. This is limited-by-design but honest: no false promise of alerts
 * when the PWA is fully closed.
 */

export type QuietHours = { start: string | null; end: string | null }; // 'HH:MM'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function permissionState(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// ── Quiet hours (pure, testable) ─────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * True when `now` falls inside the quiet window. Handles windows that wrap past
 * midnight (e.g. 22:00 → 07:00). If either bound is null, quiet hours are off.
 */
export function isWithinQuietHours(quiet: QuietHours, now: Date = new Date()): boolean {
  if (!quiet.start || !quiet.end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return false;
  return start < end
    ? cur >= start && cur < end          // same-day window
    : cur >= start || cur < end;         // wraps past midnight
}

// ── In-page reminder registry ────────────────────────────────────────────────

export interface Reminder {
  id: string;
  at: number;        // epoch ms
  title: string;
  body?: string;
  url?: string;      // route to open on click
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_DELAY = 24 * 60 * 60 * 1000; // don't hold timers longer than a day

async function fire(r: Reminder, quiet: QuietHours) {
  timers.delete(r.id);
  if (permissionState() !== 'granted') return;
  if (isWithinQuietHours(quiet)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(r.title, {
      body: r.body,
      tag: r.id,
      data: { url: r.url ?? '/' },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
  } catch {
    // Fallback to a page-level Notification if the SW isn't controlling yet.
    try { new Notification(r.title, { body: r.body, tag: r.id }); } catch { /* ignore */ }
  }
}

/** Schedule (or reschedule) a reminder. Past-due or >24h-away reminders are skipped. */
export function scheduleReminder(r: Reminder, quiet: QuietHours): void {
  clearReminder(r.id);
  const delay = r.at - Date.now();
  if (delay <= 0 || delay > MAX_DELAY) return;
  timers.set(r.id, setTimeout(() => { void fire(r, quiet); }, delay));
}

export function clearReminder(id: string): void {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
}

export function clearAllReminders(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

/** The next epoch-ms for a local 'HH:MM' today (or tomorrow if already passed). */
export function nextClockTime(hhmm: string, from: Date = new Date()): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(from);
  d.setHours(h, m || 0, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
