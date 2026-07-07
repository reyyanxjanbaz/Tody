/* Phase 6.1 — imported into the generated Workbox SW via
 * workbox.importScripts (see vite.config.ts). Handles taps on a notification:
 * focus an existing tab if one is open, otherwise open the target route. */
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
