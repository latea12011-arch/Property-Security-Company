(() => {
  'use strict';

  const config = window.ERP_CONFIG || {};
  const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = cloudEnabled ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const demoKey = 'hongjia_erp_demo_v1';

  const viewInfo = {
    dashboard: ['營運總覽', 'dashboard'], employees: ['員工管理', 'employees'], sites: ['案場管理', 'sites'],
    schedules: ['勤務排班', 'schedules'], attendance: ['出勤紀錄', 'attendance'], leaves: ['請假審核', 'leave_requests']
  };

  const fields = {
    employees: [
      ['employee_no','員工編號','text',true],['full_name','姓名','text',true],['phone','電話','tel'],['initial_password','初始登入密碼','password'],
      ['role','角色','select',true,[['guard','保全人員'],['site_manager','案場主管'],['hr','人事'],['admin','系統管理員']]],
      ['status','狀態','select',true,[['active','在職'],['inactive','離職／停用']]]
    ],
    sites: [
      ['code','案場代碼','text',true],['name','案場名稱','text',true],['address','地址','text',true],
      ['contact_name','聯絡人','text'],['contact_phone','聯絡電話','tel'],['status','狀態','select',true,[['active','啟用'],['inactive','停用']]]
    ],
    schedules: [
      ['employee_id','員工','relation:employees',true],['site_id','案場','relation:sites',true],['work_date','勤務日期','date',true],
      ['shift_type','班別','select',true,[['day','日班'],['night','夜班'],['custom','自訂']]],['start_time','開始時間','time',true],['end_time','結束時間','time',true]
    ],
    attendance: [
      ['employee_id','員工','relation:employees',true],['site_id','案場','relation:sites',true],['work_date','日期','date',true],
      ['clock_in','上班時間','datetime-local'],['clock_out','下班時間','datetime-local'],['status','狀態','select',true,[['normal','正常'],['late','遲到'],['missing','缺卡']]]
    ],
    leave_requests: [
      ['employee_id','員工','relation:employees',true],['leave_type','假別','select',true,[['annual','特休'],['personal','事假'],['sick','病假'],['official','公假']]],
      ['start_date','開始日期','date',true],['end_date','結束日期','date',true],['reason','原因','textarea',true],
      ['status','審核狀態','select',true,[['pending','待審核'],['approved','已核准'],['rejected','已退回']]]
    ]
  };

  const columns = {
    employees: [['employee_no','編號'],['full_name','姓名'],['role','角色'],['phone','電話'],['status','狀態']],
    sites: [['code','代碼'],['name','案場'],['address','地址'],['contact_name','聯絡人'],['status','狀態']],
    schedules: [['work_date','日期'],['employee_id','員工'],['site_id','案場'],['shift_type','班別'],['start_time','時間']],
    attendance: [['work_date','日期'],['employee_id','員工'],['site_id','案場'],['clock_in','上班'],['clock_out','下班'],['status','狀態']],
    leave_requests: [['employee_id','員工'],['leave_type','假別'],['start_date','開始'],['end_date','結束'],['status','狀態']]
  };

  let state = { view: 'dashboard', user: null, editing: null, relations: {employees:[],sites:[]} };

  function seedDemo() {
    const today = new Date().toISOString().slice(0,10);
    return {
      employees:[
        {id:'e1',employee_no:'A001',full_name:'王大明',phone:'0912-345-678',role:'site_manager',status:'active'},
        {id:'e2',employee_no:'A002',full_name:'陳志宏',phone:'0922-555-168',role:'guard',status:'active'},
        {id:'e3',employee_no:'A003',full_name:'林怡君',phone:'0933-812-520',role:'hr',status:'active'}
      ],
      sites:[{id:'s1',code:'TP001',name:'晴川社區',address:'台北市中山區民權東路',contact_name:'李主委',contact_phone:'02-2500-1688',status:'active'}],
      schedules:[{id:'sc1',employee_id:'e2',site_id:'s1',work_date:today,shift_type:'day',start_time:'07:00',end_time:'19:00'}],
      attendance:[{id:'a1',employee_id:'e2',site_id:'s1',work_date:today,clock_in:`${today}T06:55`,clock_out:'',status:'normal'}],
      leave_requests:[{id:'l1',employee_id:'e2',leave_type:'annual',start_date:today,end_date:today,reason:'家庭事務',status:'pending'}]
    };
  }

  function demoData() {
    let data;
    try { data = JSON.parse(localStorage.getItem(demoKey)); } catch (_) {}
    if (!data) { data = seedDemo(); localStorage.setItem(demoKey, JSON.stringify(data)); }
    return data;
  }

  const db = {
    async list(table) {
      if (!cloudEnabled) return demoData()[table] || [];
      const {data,error} = await client.from(table).select('*').order('created_at',{ascending:false});
      if (error) throw error; return data;
    },
    async save(table, record, id) {
      if (!cloudEnabled) {
        const data=demoData(); const clean={...record};
        if (id) data[table]=data[table].map(row=>row.id===id?{...row,...clean}:row);
        else data[table].unshift({id:crypto.randomUUID(),...clean});
        localStorage.setItem(demoKey,JSON.stringify(data)); return id?data[table].find(row=>row.id===id):data[table][0];
      }
      const query=(id?client.from(table).update(record).eq('id',id):client.from(table).insert(record)).select().single();
      const {data,error}=await query; if(error) throw error; return data;
    },
    async remove(table,id) {
      if (!cloudEnabled) { const data=demoData(); data[table]=data[table].filter(row=>row.id!==id); localStorage.setItem(demoKey,JSON.stringify(data)); return; }
      const {error}=await client.from(table).delete().eq('id',id); if(error) throw error;
    }
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const labels = {guard:'保全人員',site_manager:'案場主管',hr:'人事',admin:'管理員',active:'啟用／在職',inactive:'停用',day:'日班',night:'夜班',custom:'自訂',normal:'正常',late:'遲到',missing:'缺卡',annual:'特休',personal:'事假',sick:'病假',official:'公假',pending:'待審核',approved:'已核准',rejected:'已退回'};
  const format = (key,value) => {
    if ((key==='employee_id'||key==='site_id') && value) {
      const list=key==='employee_id'?state.relations.employees:state.relations.sites;
      return list.find(row=>row.id===value)?.[key==='employee_id'?'full_name':'name'] || value;
    }
    if (key==='start_time' && value) return value;
    if ((key==='clock_in'||key==='clock_out') && value) return value.replace('T',' ');
    return labels[value] || value || '—';
  };
  const badge = value => `<span class="badge ${['pending','late'].includes(value)?'warning':''} ${['inactive','missing','rejected'].includes(value)?'danger':''}">${esc(format('',value))}</span>`;
  const isBadge = key => ['status','role','shift_type','leave_type'].includes(key);

  async function loadRelations() {
    [state.relations.employees,state.relations.sites]=await Promise.all([db.list('employees'),db.list('sites')]);
  }

  async function renderDashboard() {
    const [employees,sites,schedules,attendance,leaves]=await Promise.all(['employees','sites','schedules','attendance','leave_requests'].map(db.list));
    state.relations={employees,sites};
    const today=new Date().toISOString().slice(0,10);
    const todaySchedules=schedules.filter(x=>x.work_date===today);
    const pending=leaves.filter(x=>x.status==='pending');
    $('#content').innerHTML=`
      <div class="stats">
        <article class="stat-card"><small>在職員工</small><strong>${employees.filter(x=>x.status==='active').length}</strong><em>人員帳冊</em></article>
        <article class="stat-card"><small>啟用案場</small><strong>${sites.filter(x=>x.status==='active').length}</strong><em>服務據點</em></article>
        <article class="stat-card"><small>今日勤務</small><strong>${todaySchedules.length}</strong><em>${today}</em></article>
        <article class="stat-card"><small>待審請假</small><strong>${pending.length}</strong><em>需要處理</em></article>
      </div>
      <div class="grid-2">
        <article class="panel"><div class="panel-head"><h3>今日勤務</h3><button class="mini-button" data-go="schedules">查看全部</button></div>${quickList(todaySchedules,'schedule')}</article>
        <article class="panel"><div class="panel-head"><h3>待辦事項</h3><button class="mini-button" data-go="leaves">前往審核</button></div>${quickList(pending,'leave')}</article>
      </div>`;
    $$('[data-go]').forEach(button=>button.onclick=()=>switchView(button.dataset.go));
  }

  function quickList(rows,type) {
    if(!rows.length) return '<div class="empty">目前沒有資料</div>';
    return `<div class="quick-list">${rows.slice(0,6).map(row=>type==='schedule'
      ?`<div class="quick-item"><div><strong>${esc(format('employee_id',row.employee_id))}</strong><small>${esc(format('site_id',row.site_id))} · ${esc(format('shift_type',row.shift_type))}</small></div><span class="badge">${esc(row.start_time)}－${esc(row.end_time)}</span></div>`
      :`<div class="quick-item"><div><strong>${esc(format('employee_id',row.employee_id))}</strong><small>${esc(format('leave_type',row.leave_type))} · ${esc(row.start_date)} 至 ${esc(row.end_date)}</small></div>${badge(row.status)}</div>`).join('')}</div>`;
  }

  async function renderTable(view) {
    await loadRelations(); const table=viewInfo[view][1]; const rows=await db.list(table); const cols=columns[table];
    $('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h3>${viewInfo[view][0]}</h3><span class="muted">共 ${rows.length} 筆</span></div><button class="btn primary" id="addRecord">＋ 新增</button></div>
      <div class="table-wrap"><table><thead><tr>${cols.map(x=>`<th>${x[1]}</th>`).join('')}<th>操作</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${cols.map(([key])=>`<td>${isBadge(key)?badge(row[key]):esc(format(key,row[key]))}</td>`).join('')}<td><div class="action-row"><button class="mini-button" data-edit="${esc(row.id)}">編輯</button><button class="mini-button danger" data-delete="${esc(row.id)}">刪除</button></div></td></tr>`).join(''):`<tr><td colspan="${cols.length+1}" class="empty">尚無資料，請按「新增」建立第一筆。</td></tr>`}</tbody></table></div></article>`;
    $('#addRecord').onclick=()=>openDialog(table,null);
    $$('[data-edit]').forEach(button=>button.onclick=()=>openDialog(table,rows.find(x=>x.id===button.dataset.edit)));
    $$('[data-delete]').forEach(button=>button.onclick=()=>deleteRecord(table,button.dataset.delete));
  }

  function inputFor([name,label,type,required,options],record={}) {
    record = record || {};
    const value=record[name] ?? '';
    if(type==='textarea') return `<label class="wide">${label}<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea></label>`;
    if(type==='select'||type.startsWith('relation:')) {
      let choices=options;
      if(type.startsWith('relation:')) { const relation=type.split(':')[1]; choices=state.relations[relation].map(row=>[row.id,row.full_name||row.name]); }
      return `<label>${label}<select name="${name}" ${required?'required':''}><option value="">請選擇</option>${(choices||[]).map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''}></label>`;
  }

  function openDialog(table,record) {
    state.editing={table,id:record?.id||null};
    $('#dialogTitle').textContent=`${record?'編輯':'新增'}${viewInfo[Object.keys(viewInfo).find(k=>viewInfo[k][1]===table)]?.[0]||'資料'}`;
    $('#formFields').innerHTML=fields[table].map(field=>inputFor(field,record)).join('');
    $('#formMessage').textContent=''; $('#recordDialog').showModal();
  }

  async function saveRecord(event) {
    event.preventDefault(); const {table,id}=state.editing; const form=new FormData(event.currentTarget); const record=Object.fromEntries(form.entries());
    const initialPassword=record.initial_password; delete record.initial_password;
    $('#saveButton').disabled=true; $('#formMessage').textContent='';
    try {
      const saved=await db.save(table,record,id);
      if(table==='employees' && initialPassword && cloudEnabled){
        const {data,error}=await client.functions.invoke('quick-worker',{body:{employee_id:saved.id,password:initialPassword}});
        if(error) throw error;
        if(!data?.ok) throw new Error(data?.error||'登入帳號建立失敗');
      }
      $('#recordDialog').close(); await renderCurrent(); showNotice(table==='employees'&&initialPassword?'員工與登入帳號已建立。':'資料已儲存。','success');
    }
    catch(error) { $('#formMessage').textContent=`儲存失敗：${error.message}`; }
    finally { $('#saveButton').disabled=false; }
  }

  async function deleteRecord(table,id) {
    if(!confirm('確定刪除這筆資料？此動作無法復原。')) return;
    try { await db.remove(table,id); await renderCurrent(); showNotice('資料已刪除。'); } catch(error) { showNotice(`刪除失敗：${error.message}`,'error'); }
  }

  function showNotice(message,type='info') { const n=$('#notice'); n.textContent=message; n.hidden=false; n.style.borderColor=type==='error'?'#e8aaaa':'#b9ddd4'; n.style.background=type==='error'?'#fff0f0':'#eef9f6'; clearTimeout(showNotice.timer); showNotice.timer=setTimeout(()=>n.hidden=true,4500); }
  async function renderCurrent() { try { state.view==='dashboard'?await renderDashboard():await renderTable(state.view); } catch(error) { $('#content').innerHTML=`<article class="panel empty">載入失敗：${esc(error.message)}</article>`; } }
  function switchView(view) { state.view=view; $('#pageTitle').textContent=viewInfo[view][0]; $$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); renderCurrent(); }

  async function login(email,password) {
    if (!cloudEnabled) throw new Error('尚未連接 Supabase，請改用示範模式。');
    const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
    const {data:profile}=await client.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
    state.user={email:data.user.email,name:profile?.full_name||data.user.email,role:profile?.role||'guard'}; enterApp();
  }

  function enterApp(demo=false) {
    if(demo) state.user={name:'示範管理員',email:'demo@local',role:'admin'};
    $('#loginView').hidden=true; $('#appView').hidden=false; $('#userName').textContent=state.user.name; $('#userInitial').textContent=state.user.name.slice(0,1);
    $('#modeLabel').textContent=cloudEnabled&&!demo?'雲端模式':'本機示範模式'; switchView('dashboard');
  }

  async function logout() { if(cloudEnabled) await client.auth.signOut(); state.user=null; $('#appView').hidden=true; $('#loginView').hidden=false; }

  $('#loginForm').addEventListener('submit',async event=>{event.preventDefault();$('#loginMessage').textContent='';try{await login($('#email').value,$('#password').value)}catch(error){$('#loginMessage').textContent=error.message}});
  $('#demoButton').onclick=()=>enterApp(true); $('#logoutButton').onclick=logout; $('#recordForm').addEventListener('submit',saveRecord);
  $$('[data-close-dialog]').forEach(button=>button.onclick=()=>$('#recordDialog').close());
  $$('[data-view]').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
  if('serviceWorker' in navigator && location.protocol!=='file:') window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  if(cloudEnabled) client.auth.getSession().then(({data})=>{if(data.session){state.user={name:data.session.user.email,email:data.session.user.email,role:'guard'};enterApp();}});
})();
