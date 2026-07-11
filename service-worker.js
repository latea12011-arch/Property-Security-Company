const CACHE_NAME = 'hongjia-property-app-v4';
const ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'schedule.html',
  'leave.html',
  'committee.html',
  'manifest.json',
  'committee-manifest.json',
  'assets/company-logo.png',
  'assets/company-icon.svg',
  'assets/pwa.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          return response;
        })
        .catch(() => caches.match(e.request).then((response) => response || caches.match('index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) return response;
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
