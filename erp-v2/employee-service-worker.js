const EMPLOYEE_CACHE='hongjia-employee-pwa-v30';
const EMPLOYEE_SHELL=['./mobile.html','./favicon-v2.ico','./config.js','./mobile-manifest-v2.json','./assets/mobile.css','./assets/mobile-enhancements.css','./assets/mobile.js','./assets/bank-master.js','./assets/push-notifications.js','./assets/company-logo.png','./assets/employee-icon-v2-192.png','./assets/employee-icon-v2-512.png','./assets/employee-icon-v2-maskable.png'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(EMPLOYEE_CACHE).then(cache=>cache.addAll(EMPLOYEE_SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hongjia-employee-pwa-')&&key!==EMPLOYEE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(EMPLOYEE_CACHE).then(cache=>cache.put(event.request,response.clone()));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./mobile.html'))));return}if(url.origin!==location.origin){event.respondWith(fetch(event.request));return}const update=fetch(event.request).then(response=>{if(response.ok)caches.open(EMPLOYEE_CACHE).then(cache=>cache.put(event.request,response.clone()));return response});event.respondWith(caches.match(event.request).then(cached=>cached||update));event.waitUntil(update.catch(()=>undefined))});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}event.waitUntil(self.registration.showNotification(data.title||'紘嘉物業員工通知',{body:data.body||'',icon:'./assets/employee-icon-v2-192.png',badge:'./assets/employee-icon-v2-192.png',tag:data.tag||'hongjia-employee',data:{url:data.url||'./mobile.html'}}))});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    // Resolve against this worker's directory, including the GitHub Pages project path.
    const safe=new URL('./mobile.html',self.location.href);
    try{
      const requested=new URL(event.notification.data?.url||'./mobile.html',safe);
      const tab=requested.searchParams.get('tab');
      if(tab)safe.searchParams.set('tab',tab);
    }catch{}
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    const current=list.find(client=>{
      try{const url=new URL(client.url);return url.origin===safe.origin&&url.pathname===safe.pathname}catch{return false}
    });
    if(current){
      try{const navigated=await current.navigate(safe.href);if(navigated)return await navigated.focus()}catch{}
    }
    return clients.openWindow(safe.href);
  })());
});
