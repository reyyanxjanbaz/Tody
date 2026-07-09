/**
 * Web Push subscription (client side).
 *
 * Complements the local, in-page reminders in notifications.ts with true
 * server-initiated push (delivered by server/push.py even when the PWA is
 * closed). Permission is only ever requested from an explicit user action;
 * subscribe/unsubscribe are safe no-ops when unsupported or unconfigured.
 */
import { api } from './api';
import { requestNotificationPermission } from './notifications';

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

/** VAPID public keys are base64url; PushManager wants an ArrayBuffer view. Exported for tests. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Ensure this device is subscribed to push. Assumes Notification permission is
 * already granted (call after requestNotificationPermission()). Returns true on
 * success. Reuses an existing subscription when present.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Reuse an existing subscription if the browser already has one.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { data } = await api.get<{ public_key: string }>('/push/vapid-key');
      const key = data?.public_key;
      if (!key) return false; // backend has no VAPID key configured yet
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const { error } = await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Contextual, one-time push opt-in. Call from a strong-intent action (creating
 * a pact, joining a shared workspace). Only prompts if the user hasn't decided
 * yet — never nags a previously-granted or -denied state. Subscribes on grant.
 */
export async function maybePromptPush(): Promise<void> {
  if (!pushSupported() || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') {
    // Already granted → ensure this device is subscribed; denied → do nothing.
    if (Notification.permission === 'granted') void subscribeToPush();
    return;
  }
  const p = await requestNotificationPermission();
  if (p === 'granted') await subscribeToPush();
}

/** Remove this device's push subscription (best-effort, both ends). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await api.post('/push/unsubscribe', { endpoint });
  } catch {
    /* ignore */
  }
}
