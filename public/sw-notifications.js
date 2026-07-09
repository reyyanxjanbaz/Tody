/* Phase 6.1 — imported into the generated Workbox SW via
 * workbox.importScripts (see vite.config.ts). Handles taps on a notification:
 * focus an existing tab if one is open, otherwise open the target route.
 * Also handles server-initiated Web Push (assignment / pact / friend events). */

/* Web Push: the backend (server/push.py) sends a JSON payload
 * { title, body, url, category }. Show it as a notification; the tag dedupes
 * repeat pushes for the same target so they collapse instead of stacking. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Tody';
  const url = data.url || '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.category ? `${data.category}:${url}` : url,
      data: { url },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) { try { client.navigate(url); } catch (e) { /* cross-origin */ } }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
