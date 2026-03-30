// public/sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.2.0/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded');

  // Precache
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Cache API calls (Stale While Revalidate)
  workbox.routing.registerRoute(
    ({ url }) => url.protocol === 'https' || url.hostname.includes('localhost'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'spartan-api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 200 }),
      ],
    })
  );

  // Cache images
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'spartan-images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    })
  );

  // Offline fallback for navigation
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkOnly({
      plugins: [
        {
          handlerDidError: async () => {
            return caches.match('/offline.html') || 
                   new Response('You are offline. Please check your connection.', {
                     status: 503,
                     statusText: 'Service Unavailable',
                     headers: { 'Content-Type': 'text/plain' },
                   });
          },
        },
      ],
    })
  );
} else {
  console.error('Workbox could not be loaded');
}

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Spartan Bank', body: 'You have a new notification.' };
  if (event.data) {
    data = event.data.json();
  }

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/spartan-logo-192.png',   // make sure this file exists in /public
    badge: '/spartan-logo-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));