// Replaces hongjia-erp-v2-89 so installed ERP apps receive police approval print selection.
const CACHE = 'hongjia-erp-v2-90';
const SHELL = ['./','index.html','mobile.html','favicon-v2.ico','config.js','manifest-v2.json','mobile-manifest-v2.json','assets/app.css','assets/app.js','assets/calendar.js','assets/tender-quotes.js','assets/tender-documents.js','assets/tender-contracts.js','assets/police-approvals.js','assets/website-notifications.js','assets/mobile.css','assets/mobile-enhancements.css','assets/mobile.js','assets/company-logo.png','assets/erp-icon-v2-192.png','assets/erp-icon-v2-512.png','assets/erp-icon-v2-maskable.png','assets/employee-icon-v2-192.png','assets/employee-icon-v2-512.png','assets/employee-icon-v2-maskable.png'];

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

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('/assets/app.js') || url.pathname.endsWith('/assets/calendar.js') || url.pathname.endsWith('/assets/tender-quotes.js') || url.pathname.endsWith('/assets/tender-documents.js') || url.pathname.endsWith('/assets/tender-contracts.js') || url.pathname.endsWith('/assets/police-approvals.js') || url.pathname.endsWith('/assets/website-notifications.js') || url.pathname.endsWith('/assets/app.css') || url.pathname.endsWith('/assets/mobile.js') || url.pathname.endsWith('/assets/mobile.css')) {
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
