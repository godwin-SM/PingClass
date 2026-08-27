// PingClass Service Worker — Push Notifications
const CACHE_NAME = 'pingclass-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'PingClass', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag || 'pingclass-notification',
    renotify: true,
    data: payload.data || {},
    actions: payload.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'PingClass', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  const page = data.page || 'parent-dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('parent-dashboard') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICKED', page });
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow('/' + page);
    })
  );
});
