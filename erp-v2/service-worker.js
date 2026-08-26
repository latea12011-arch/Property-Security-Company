// Previous caches: hongjia-erp-v2-102, hongjia-erp-v2-103, hongjia-erp-v2-104.
const CACHE = 'hongjia-erp-v2-153';
const SHELL = ['./','index.html','mobile.html','favicon-v2.ico','config.js','manifest-v2.json','mobile-manifest-v2.json','assets/app.css','assets/app.js','assets/custom-dialogs.js','assets/committee-management.js','assets/committee-account-delete.js','assets/push-notifications.js','assets/employee-import.js','assets/employee-documents.js','assets/employee-batch-actions.js','assets/attendance-corrections.js','assets/templates/employee-import-template.xlsx','assets/employee-documents/community-security-work-rules.pdf','assets/employee-documents/employment-agreement.pdf','assets/employee-documents/personal-data-protection-undertaking.pdf','assets/employee-documents/police-filing-consent.pdf','assets/employee-documents/labor-standards-act-84-1-agreement.pdf','assets/calendar.js','assets/billing-claims.js','assets/tender-quotes.js','assets/tender-documents.js','assets/tender-contracts.js','assets/contracts/hongjia-property-mark.png','assets/contracts/hongjia-property-full-logo.png','assets/contracts/hongjia-security-knight-logo.png','assets/contracts/hongjia-line-official-qr.png','assets/police-approvals.js','assets/labor-84-1-approvals.js','assets/website-notifications.js','assets/mobile.css','assets/mobile-enhancements.css','assets/mobile.js','assets/company-logo.png','assets/erp-icon-v2-192.png','assets/erp-icon-v2-512.png','assets/erp-icon-v2-maskable.png','assets/employee-icon-v2-192.png','assets/employee-icon-v2-512.png','assets/employee-icon-v2-maskable.png'];

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

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('/assets/app.js') || url.pathname.endsWith('/assets/committee-management.js') || url.pathname.endsWith('/assets/committee-account-delete.js') || url.pathname.endsWith('/assets/push-notifications.js') || url.pathname.endsWith('/assets/employee-import.js') || url.pathname.endsWith('/assets/calendar.js') || url.pathname.endsWith('/assets/tender-quotes.js') || url.pathname.endsWith('/assets/tender-documents.js') || url.pathname.endsWith('/assets/tender-contracts.js') || url.pathname.endsWith('/assets/police-approvals.js') || url.pathname.endsWith('/assets/labor-84-1-approvals.js') || url.pathname.endsWith('/assets/website-notifications.js') || url.pathname.endsWith('/assets/app.css') || url.pathname.endsWith('/assets/mobile.js') || url.pathname.endsWith('/assets/mobile.css')) {
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
