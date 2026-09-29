(()=>{
  'use strict';
  const client=window.ERP_CLIENT;
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const number=value=>Number(value||0);
  const hours=value=>number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const money=value=>Math.round(number(value)).toLocaleString('zh-TW');
  const statusLabels={pending:'待審核',approved:'已核准',rejected:'已退回',paid:'已換薪',cancelled:'已取消'};
  const consumingStatuses=new Set(['approved','paid']);
  let rows=[],employees=[],editing=null;

  function statusBadge(status){return`<span class="badge ${status==='pending'?'warning':''} ${['rejected','cancelled'].includes(status)?'danger':''}">${esc(statusLabels[status]||status)}</span>`}
  function employeeContext(id){return employees.find(item=>item.employee_id===id)}
  function spendableFor(employee,row){
    if(!employee)return 0;
    const pending=rows.filter(item=>item.employee_id===employee.employee_id&&item.status==='pending'&&item.id!==row?.id).reduce((sum,item)=>sum+number(item.requested_hours),0);
    const restore=row&&consumingStatuses.has(row.status)?number(row.requested_hours):0;
    return Math.max(0,number(employee.remaining_hours)+restore-pending);
  }
  async function load(){
    if(!client)throw Error('特休換薪需要使用 ERP 雲端模式。');
    const[{data:cashouts,error:cashoutError},{data:directory,error:directoryError}]=await Promise.all([
      client.from('annual_leave_cashouts').select('*').order('application_date',{ascending:false}).order('created_at',{ascending:false}),
      client.rpc('list_annual_leave_cashout_employees')
    ]);
    if(cashoutError)throw cashoutError;
    if(directoryError)throw directoryError;
    rows=cashouts||[];employees=directory||[];
  }
  function summaryCards(){
    const pending=rows.filter(row=>row.status==='pending'),approved=rows.filter(row=>row.status==='approved'),paid=rows.filter(row=>row.status==='paid');
    return`<section class="annual-cashout-stats"><article><small>待審核</small><strong>${pending.length}</strong><span>筆申請</span></article><article><small>已核准待換薪</small><strong>${approved.length}</strong><span>NT$ ${money(approved.reduce((sum,row)=>sum+number(row.calculated_amount),0))}</span></article><article><small>已完成換薪</small><strong>${paid.length}</strong><span>NT$ ${money(paid.reduce((sum,row)=>sum+number(row.calculated_amount),0))}</span></article></section>`;
  }
  function table(){
    return`<div class="table-wrap"><table><thead><tr><th>申請單號</th><th>申請日</th><th>員工</th><th>特休年度</th><th>換薪時數</th><th>計算基準</th><th>換薪金額</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${esc(row.application_no)}</strong></td><td>${esc(row.application_date)}</td><td><strong>${esc(row.employee_name_snapshot)}</strong><small>${esc(row.employee_no_snapshot)}・${esc(row.job_title_snapshot)}</small></td><td>${esc(row.leave_period_start)}<small>至 ${esc(row.leave_period_end)}</small></td><td>${hours(row.requested_hours)} 小時</td><td>${hours(row.daily_hours_basis)} 小時制<small>時薪 NT$ ${money(row.hourly_rate)}</small></td><td><strong>NT$ ${money(row.calculated_amount)}</strong></td><td>${statusBadge(row.status)}</td><td><div class="action-row"><button class="mini-button" data-cashout-edit="${esc(row.id)}">編輯／審核</button><button class="mini-button" data-cashout-print="${esc(row.id)}">列印</button></div></td></tr>`).join(''):'<tr><td colspan="9" class="empty">尚無特休換薪申請紀錄。</td></tr>'}</tbody></table></div>`;
  }
  async function render(){
    const host=$('#content');host.innerHTML='<article class="panel empty">正在計算特休餘額與薪資…</article>';
    try{await load()}catch(error){host.innerHTML=`<article class="panel empty"><strong>特休換薪資料載入失敗</strong><p>${esc(error.message)}</p><small>若功能剛發布，請先套用 migration-annual-leave-cashouts.sql。</small></article>`;return}
    host.innerHTML=`<article class="panel annual-cashout-panel"><div class="panel-head"><div><h3>特休換薪申請單</h3><span class="muted">滿一年後依到職週年重新計算；核准換薪會同步扣除當期特休餘額</span></div><button class="btn primary" id="addAnnualCashout">＋ 新增申請單</button></div>${summaryCards()}${table()}<section class="annual-cashout-method"><strong>換薪計算方式</strong><p>換薪金額＝月薪 ÷ 30 ÷ 每日計算時數 × 申請換薪時數，金額四捨五入至元。</p><p>保全職務採 10 小時制；總幹事、社區秘書／秘書及內部人員採 8 小時制。其他職務預設 8 小時制。</p></section></article>`;
    $('#addAnnualCashout').onclick=()=>openDialog();
    document.querySelectorAll('[data-cashout-edit]').forEach(button=>button.onclick=()=>openDialog(rows.find(row=>row.id===button.dataset.cashoutEdit)));
    document.querySelectorAll('[data-cashout-print]').forEach(button=>button.onclick=()=>printRow(rows.find(row=>row.id===button.dataset.cashoutPrint)));
  }
  function ensureDialog(){
    let dialog=$('#annualCashoutDialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='annualCashoutDialog';dialog.className='annual-cashout-dialog';dialog.innerHTML=`<form id="annualCashoutForm"><div class="dialog-head"><div><p class="eyebrow">薪資與行政</p><h3 id="annualCashoutDialogTitle">新增特休換薪申請單</h3></div><button type="button" class="icon-button" data-cashout-close aria-label="關閉">×</button></div><div class="form-grid"><label class="wide">申請員工<select name="employee_id" required></select></label><label>申請日期<input name="application_date" type="date" readonly required></label><label>申請換薪時數<input name="requested_hours" type="number" min="0.5" step="0.5" required></label><label>審核狀態<select name="status" required><option value="pending">待審核</option><option value="approved">已核准</option><option value="rejected">已退回</option><option value="paid">已完成換薪</option><option value="cancelled">已取消</option></select></label><label class="wide">申請／備註<textarea name="note" rows="3"></textarea></label><label class="wide">審核備註<textarea name="review_note" rows="3"></textarea></label><section id="annualCashoutPreview" class="annual-cashout-preview wide"></section></div><p id="annualCashoutMessage" class="form-message"></p><div class="dialog-actions"><button type="button" class="btn ghost" data-cashout-close>取消</button><button type="submit" class="btn primary">儲存申請單</button></div></form>`;document.body.appendChild(dialog);dialog.querySelectorAll('[data-cashout-close]').forEach(button=>button.onclick=()=>dialog.close());dialog.querySelector('form').onsubmit=save;return dialog;
  }
  function openDialog(row=null){
    editing=row||null;const dialog=ensureDialog(),form=dialog.querySelector('form'),today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
    form.reset();$('#annualCashoutDialogTitle').textContent=row?'編輯／審核特休換薪申請單':'新增特休換薪申請單';
    const employeeSelect=form.elements.employee_id;employeeSelect.innerHTML='<option value="">請選擇員工</option>'+employees.map(employee=>`<option value="${esc(employee.employee_id)}" ${employee.eligible?'':'disabled'}>${esc(employee.employee_no)}－${esc(employee.full_name)}${employee.eligible?'':'（未滿一年或尚無薪資設定）'}</option>`).join('');
    employeeSelect.value=row?.employee_id||'';employeeSelect.disabled=Boolean(row);form.elements.application_date.value=row?.application_date||today;form.elements.requested_hours.value=row?.requested_hours||'';form.elements.status.value=row?.status||'pending';form.elements.note.value=row?.note||'';form.elements.review_note.value=row?.review_note||'';$('#annualCashoutMessage').textContent='';
    employeeSelect.onchange=refreshPreview;form.elements.requested_hours.oninput=refreshPreview;refreshPreview();dialog.showModal();
  }
  function refreshPreview(){
    const form=$('#annualCashoutForm'),employee=employeeContext(form.elements.employee_id.value),preview=$('#annualCashoutPreview');if(!employee){preview.innerHTML='<span class="muted">選擇員工後，將自動帶入本期特休與薪資計算基準。</span>';return}
    const available=spendableFor(employee,editing),requested=number(form.elements.requested_hours.value),amount=Math.round(requested*number(employee.hourly_rate)),days=requested/number(employee.daily_hours||8);
    preview.innerHTML=`<div><small>到職日期</small><strong>${esc(employee.hire_date||'未設定')}</strong></div><div><small>本期特休</small><strong>${esc(employee.period_start||'—')} 至 ${esc(employee.period_end||'—')}</strong></div><div><small>總額度／已使用</small><strong>${hours(employee.entitlement_hours)}／${hours(employee.used_hours)} 小時</strong></div><div><small>目前可換薪</small><strong>${hours(available)} 小時</strong></div><div><small>月薪／計算時數</small><strong>NT$ ${money(employee.monthly_salary)}／每日 ${hours(employee.daily_hours)} 小時</strong></div><div><small>換算時薪</small><strong>NT$ ${money(employee.hourly_rate)}</strong></div><div class="annual-cashout-total"><small>本次申請</small><strong>${hours(requested)} 小時（${hours(days)} 日）</strong></div><div class="annual-cashout-total"><small>預估換薪金額</small><strong>NT$ ${money(amount)}</strong></div>${requested>available?'<p class="cashout-error">申請時數超過目前可換薪餘額。</p>':''}`;
  }
  async function save(event){
    event.preventDefault();const form=event.currentTarget,message=$('#annualCashoutMessage'),button=form.querySelector('[type="submit"]'),employee=employeeContext(form.elements.employee_id.value),requested=number(form.elements.requested_hours.value);
    if(!employee){message.textContent='請選擇已到職滿一年且已建立薪資設定的員工。';return}if(requested<=0||requested>spendableFor(employee,editing)){message.textContent='申請時數不可超過目前可換薪餘額。';return}
    const payload={employee_id:employee.employee_id,application_date:form.elements.application_date.value,requested_hours:requested,status:form.elements.status.value,note:form.elements.note.value.trim()||null,review_note:form.elements.review_note.value.trim()||null};button.disabled=true;message.textContent='正在重新核對特休與薪資…';
    try{const query=editing?client.from('annual_leave_cashouts').update(payload).eq('id',editing.id):client.from('annual_leave_cashouts').insert(payload),{error}=await query;if(error)throw error;$('#annualCashoutDialog').close();await render()}catch(error){message.textContent=`儲存失敗：${error.message}`}finally{button.disabled=false}
  }
  function printRow(row){
    if(!row)return;
    const old=$('#annualCashoutPrintFrame');if(old)old.remove();
    const frame=document.createElement('iframe');frame.id='annualCashoutPrintFrame';frame.title='特休換薪申請單列印';frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none';document.body.appendChild(frame);
    const days=number(row.requested_hours)/number(row.daily_hours_basis||8);
    frame.onload=()=>setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000)},180);
    frame.srcdoc=`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(row.application_no)} 特休換薪申請單</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:"Microsoft JhengHei",sans-serif;color:#142b3d;margin:0}header{text-align:center;border-bottom:2px solid #183b59;padding-bottom:12px;margin-bottom:18px}h1{font-size:22px;margin:0 0 7px}h2{font-size:20px;letter-spacing:4px;margin:0}table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #40586c;padding:10px}th{width:20%;background:#f0f5f7}.amount{font-size:22px;text-align:center;font-weight:800}.notice{margin:18px 0;padding:12px;border:1px solid #9eb0bd;line-height:1.7}.sign{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:58px}.sign p{margin:0 0 42px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><h1>紘嘉物業集團</h1><h2>特休換薪申請單</h2></header><table><tr><th>申請單號</th><td>${esc(row.application_no)}</td><th>申請日期</th><td>${esc(row.application_date)}</td></tr><tr><th>員工姓名</th><td>${esc(row.employee_name_snapshot)}</td><th>員工編號</th><td>${esc(row.employee_no_snapshot)}</td></tr><tr><th>職稱</th><td>${esc(row.job_title_snapshot)}</td><th>特休期間</th><td>${esc(row.leave_period_start)} 至 ${esc(row.leave_period_end)}</td></tr><tr><th>年度特休</th><td>${hours(row.entitlement_hours_snapshot)} 小時</td><th>申請前可用</th><td>${hours(row.available_hours_snapshot)} 小時</td></tr><tr><th>申請換薪</th><td>${hours(row.requested_hours)} 小時（${hours(days)} 日）</td><th>計算基準</th><td>每日 ${hours(row.daily_hours_basis)} 小時</td></tr><tr><th>月薪</th><td>NT$ ${money(row.monthly_salary)}</td><th>換算時薪</th><td>NT$ ${money(row.hourly_rate)}</td></tr><tr><th>換薪金額</th><td colspan="3" class="amount">NT$ ${money(row.calculated_amount)}</td></tr><tr><th>申請說明</th><td colspan="3">${esc(row.note||'')}</td></tr><tr><th>審核結果</th><td>${esc(statusLabels[row.status]||row.status)}</td><th>審核備註</th><td>${esc(row.review_note||'')}</td></tr></table><p class="notice">本人申請將上述特別休假時數折算工資，並確認核准後該時數將自本期特休餘額扣除。</p><div class="sign"><p>申請人簽名：________________</p><p>行政覆核：________________</p><p>會計覆核：________________</p><p>核准日期：______年____月____日</p></div></body></html>`;
  }
  window.AnnualLeaveCashouts={render};
})();
