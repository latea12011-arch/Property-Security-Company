const CACHE = 'hongjia-erp-v2-22';
const SHELL = ['./','index.html','mobile.html','config.js','manifest.json','mobile-manifest.json','assets/app.css','assets/app.js','assets/mobile.css','assets/mobile.js','assets/company-logo.png','assets/company-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('/assets/app.js') || url.pathname.endsWith('/assets/app.css') || url.pathname.endsWith('/assets/mobile.js') || url.pathname.endsWith('/assets/mobile.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
