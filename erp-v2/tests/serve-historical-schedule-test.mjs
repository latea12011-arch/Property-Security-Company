// Local-only browser fixture. All persistence uses the app's demo store.
import http from 'node:http';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){
    const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('</body>','<script src="/assets/lazy-libs.js"></script><script src="/assets/schedule-import.js"></script><script src="/test-app.js"></script></body>');
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
  }
  if(url.pathname==='/test-app.js'){
    let app='window.ERP_LOCAL_TEST_DEMO=true;window.confirm=()=>true;\n'+read('assets/app.js');
    app=app.replace("if('serviceWorker' in navigator&&location.protocol!=='file:')","if(false)");
    app=app.replace("  if(cloudEnabled) client.auth.getSession()","  state.scheduleMonth='2026-08';enterApp(true);\n  if(cloudEnabled) client.auth.getSession()");
    app=app.replace("    if($('#saveMonth'))$('#saveMonth').onclick=()=>saveSiteMonthlySchedule(employees,site);",`    const fixtureButton=document.createElement('button');fixtureButton.textContent='測試匯入歷史 CSV';fixtureButton.onclick=()=>{const person=state.relations.employees[1],csv='月份,115年8月\\n姓名,2026-08-01,2026-08-02\\n'+person.full_name+',日班 07-19,婚假';importSiteScheduleFile(new File(['\\ufeff'+csv],'history.csv',{type:'text/csv'}),employees,site)};$('.site-schedule-toolbar').appendChild(fixtureButton);\n    if($('#saveMonth'))$('#saveMonth').onclick=()=>saveSiteMonthlySchedule(employees,site);`);
    res.setHeader('Content-Type','application/javascript; charset=utf-8');res.end(app);return;
  }
  if(/^\/assets\/[a-zA-Z0-9._-]+$/.test(url.pathname)){
    try{const path=url.pathname.slice(1);res.setHeader('Content-Type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':'image/png');res.end(fs.readFileSync(new URL(path,root)));return;}catch{}
  }
  res.statusCode=404;res.end('Not found');
}).listen(8771,'127.0.0.1',()=>console.log('Historical schedule fixture: http://127.0.0.1:8771/ (open 勤務排班)'));
