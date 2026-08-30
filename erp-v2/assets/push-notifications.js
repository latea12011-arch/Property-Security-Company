(()=>{'use strict';
const cfg=window.ERP_CONFIG||{},client=window.ERP_CLIENT||(window.supabase&&window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey));
let mode='employee',target=null,channel=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const keyBytes=value=>{const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))};
async function saveSubscription(){
  if(!client||!cfg.pushPublicKey||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('此裝置尚未支援 App 推播');
  const{data:{user}}=await client.auth.getUser();if(!user)throw Error('請先登入');
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(cfg.pushPublicKey)});
  const value=subscription.toJSON(),{error}=await client.from('push_subscriptions').upsert({user_id:user.id,endpoint:value.endpoint,p256dh:value.keys.p256dh,auth:value.keys.auth,user_agent:navigator.userAgent,platform:mode},{onConflict:'endpoint'});
  if(error)throw error;return subscription;
}
async function enable(){
  if(!('Notification'in window))throw Error('此瀏覽器不支援通知');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('您尚未允許通知權限');
  await saveSubscription();await load();return true;
}
function employeeTarget(targetUrl){
  if(mode!=='employee')return targetUrl;
  try{const url=new URL(targetUrl||'',location.href),tab=url.searchParams.get('tab');return tab&&document.getElementById(tab)?`./mobile.html?tab=${encodeURIComponent(tab)}`:'./mobile.html'}catch{return './mobile.html'}
}
function openEmployeeTarget(targetUrl){
  if(mode!=='employee')return false;
  let tab='';try{tab=new URL(targetUrl||'',location.href).searchParams.get('tab')||''}catch{}
  const tabButton=tab?document.querySelector(`[data-tab="${CSS.escape(tab)}"]`):null;
  if(tabButton&&document.getElementById(tab)){tabButton.click();history.replaceState(null,'',`${location.pathname}?tab=${encodeURIComponent(tab)}`)}
  return true;
}
async function showLocal(item){if(Notification.permission!=='granted')return;const registration=await navigator.serviceWorker.ready;await registration.showNotification(item.title,{body:item.body,icon:'assets/employee-icon-v2-192.png',badge:'assets/employee-icon-v2-192.png',tag:item.id,data:{url:employeeTarget(item.target_url)}})}
const notificationItem=item=>`<button type="button" class="notification-inbox-item ${item.read_at?'':'unread'}" data-notification-id="${item.id}"><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span><small>${new Date(item.created_at).toLocaleString('zh-TW')}</small></button>`;
function bindNotificationItems(rows){target.querySelectorAll('[data-notification-id]').forEach(button=>button.onclick=async()=>{const item=rows.find(row=>row.id===button.dataset.notificationId);if(!item)return;await client.from('app_notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);item.read_at=new Date().toISOString();button.classList.remove('unread');if(openEmployeeTarget(item.target_url)){load();return}if(item.target_url)location.href=item.target_url;else load()})}
function renderEmployee(rows){if(!rows.length){target.innerHTML='<div class="empty">目前沒有通知</div>';return}const visible=rows.slice(0,10),unread=visible.filter(item=>!item.read_at).length;target.innerHTML=`<div class="employee-notification-summary"><span>最近通知</span><small>${unread?`${unread} 則未讀 · `:''}最多保留 10 則</small></div>${visible.map(notificationItem).join('')}`;bindNotificationItems(visible)}
function render(rows){if(!target)return;if(mode==='employee'){renderEmployee(rows);return}target.innerHTML=rows.length?rows.map(notificationItem).join(''):'<div class="empty">目前沒有通知</div>';bindNotificationItems(rows)}
function ensureAdminUI(){let panel=document.querySelector('#adminNotificationPanel');if(panel)return panel.querySelector('#adminNotificationList');const topbar=document.querySelector('.topbar');if(!topbar)return null;const wrap=document.createElement('div');wrap.className='admin-notification-wrap';wrap.innerHTML='<button type="button" id="adminNotificationButton" class="admin-notification-button" aria-label="ERP 通知">🔔<b id="adminNotificationBadge" hidden>0</b></button><aside id="adminNotificationPanel" class="admin-notification-panel" hidden><div class="admin-notification-head"><div><small>ERP NOTIFICATIONS</small><h3>通知中心</h3></div><button type="button" id="enableAdminNotifications" class="mini-button">開啟桌面通知</button></div><div id="adminNotificationList"></div></aside>';topbar.appendChild(wrap);wrap.querySelector('#adminNotificationButton').onclick=()=>{panel=wrap.querySelector('#adminNotificationPanel');panel.hidden=!panel.hidden;if(!panel.hidden)load()};wrap.querySelector('#enableAdminNotifications').onclick=async event=>{event.currentTarget.disabled=true;try{await enable();event.currentTarget.textContent='桌面通知已開啟'}catch(error){alert(error.message)}finally{event.currentTarget.disabled=false}};document.addEventListener('hongjia-notification-count',event=>{const badge=wrap.querySelector('#adminNotificationBadge'),count=event.detail.count;badge.textContent=count>99?'99+':String(count);badge.hidden=!count});return wrap.querySelector('#adminNotificationList')}
async function load(){if(!client||!target)return[];if(mode==='employee')await client.rpc('prune_my_app_notifications',{keep_count:10});const limit=mode==='employee'?10:30,{data,error}=await client.from('app_notifications').select('*').order('created_at',{ascending:false}).limit(limit);if(error){target.innerHTML='<div class="empty">通知功能正在更新中</div>';return[]}const rows=(data||[]).filter(item=>{if(item.notification_type!=='announcement')return true;try{const value=JSON.parse(item.body);return !(value&&typeof value==='object'&&('updated_at'in value||'event_date'in value))}catch{return true}});render(rows);document.dispatchEvent(new CustomEvent('hongjia-notification-count',{detail:{count:rows.filter(x=>!x.read_at).length}}));return rows}
async function dispatch(){for(let attempt=0;attempt<2;attempt+=1){try{const{error}=await client.functions.invoke('push-dispatch',{body:{action:'dispatch'}});if(!error)return true}catch(_){}if(!attempt)await new Promise(resolve=>setTimeout(resolve,1200))}return false
}
async function init(options={}){mode=options.mode||mode;target=typeof options.target==='string'?document.querySelector(options.target):options.target||target;if(mode==='admin'&&!target)target=ensureAdminUI();if(!client||!target)return;await load();if(Notification.permission==='granted'&&cfg.pushPublicKey)saveSubscription().catch(()=>{});const{data:{user}}=await client.auth.getUser();if(!user)return;channel?.unsubscribe();channel=client.channel(`app-notifications-${user.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'app_notifications',filter:`recipient_user_id=eq.${user.id}`},payload=>{showLocal(payload.new).catch(()=>{});load()}).subscribe()}
window.HongJiaPush={init,enable,load,dispatch};
})();
