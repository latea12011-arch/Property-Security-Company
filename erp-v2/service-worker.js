// Previous caches: hongjia-erp-v2-102, hongjia-erp-v2-103, hongjia-erp-v2-104.
const CACHE = 'hongjia-erp-v2-162';
// 舊版會在安裝時一次下載所有 PDF、Excel 與大型圖片，造成第一次開啟明顯卡頓。
// 只保留啟動畫面必需資源，其他功能首次使用時再快取。
const SHELL = ['./','index.html','mobile.html','favicon-v2.ico','config.js','manifest-v2.json','mobile-manifest-v2.json','assets/app.css','assets/app.js','assets/lazy-libs.js','assets/mobile.css','assets/mobile-enhancements.css','assets/mobile.js','assets/company-logo.png','assets/erp-icon-v2-192.png','assets/employee-icon-v2-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hongjia-erp-v2-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
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
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(event.request).then(cached => {
      const update = fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      });
      if (cached) { event.waitUntil(update.catch(() => undefined)); return cached; }
      return update;
    }));
    return;
  }
  event.respondWith(fetch(event.request));
});
