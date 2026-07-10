
const BASE_GAS_URL = "https://script.google.com/macros/s/AKfycbzQp1OVw4DdjuO0XzQUH3G8b2I0URZcJqViMppUbnRcOFQZSBh8K2f3IkNOneB-ohM/exec";
const SESSION_KEY = "hongjia_employee_session_v2";

function saveSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch(e) { return null; }
}
function requireSession() {
  const s = getSession();
  if(!s || !s.employeeId) { location.href = "index.html"; return null; }
  return s;
}
function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.href = "index.html";
}
function showLoading(text) {
  const el = document.getElementById("loading");
  const t = document.getElementById("loadingText");
  if(t) t.textContent = text || "資料處理中...";
  if(el) el.style.display = "flex";
}
function hideLoading() {
  const el = document.getElementById("loading");
  if(el) el.style.display = "none";
}
function jsonp(url, callbackName) {
  return new Promise((resolve,reject)=>{
    let done=false;
    const cleanup=()=>{ const s=document.getElementById(callbackName); if(s)s.remove(); try{delete window[callbackName]}catch(e){} };
    const timer=setTimeout(()=>{ if(done)return; done=true; cleanup(); reject(new Error("timeout")); },15000);
    window[callbackName]=(data)=>{ if(done)return; done=true; clearTimeout(timer); cleanup(); resolve(data); };
    const script=document.createElement("script");
    script.id=callbackName;
    script.src=url+(url.includes("?")?"&":"?")+"callback="+encodeURIComponent(callbackName)+"&_ts="+Date.now();
    script.onerror=()=>{ if(done)return; done=true; clearTimeout(timer); cleanup(); reject(new Error("network")); };
    document.body.appendChild(script);
  });
}
function esc(v) {
  return String(v==null?"":v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function currentMonthName() {
  const d=new Date();
  return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,"0")}月`;
}
function initBrandUser() {
  const s=getSession();
  document.querySelectorAll("[data-emp-name]").forEach(el=>el.textContent=s?.employeeName||"同仁");
}
