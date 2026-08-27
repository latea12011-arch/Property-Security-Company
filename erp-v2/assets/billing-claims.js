(() => {
  'use strict';

  const cfg=window.ERP_CONFIG||{};
  const cloud=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase);
  const client=cloud?(window.ERP_CLIENT||(window.ERP_CLIENT=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey))):null;
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const demoKey='hongjia_community_billing_claims_demo';
  const companies={
    security:{name:'紘嘉保全股份有限公司',taxId:'94012985'},
    property:{name:'紘嘉公寓大廈管理維護股份有限公司',taxId:'70409141'}
  };
  const statusLabels={draft:'草稿',sent:'已送出',paid:'已收款',cancelled:'已取消'};
  const taxLabels={tax_included:'稅內含',tax_excluded:'稅外加（未稅金額另加 5%）',tax_exempt:'免稅'};
  let sites=[];
  let claims=[];
  let notice=(message,type)=>console[type==='error'?'error':'log'](message);
  const useCloud=()=>cloud&&!window.ERP_DEMO_MODE;
  const readDemo=()=>JSON.parse(localStorage.getItem(demoKey)||'[]');
  const saveDemo=rows=>localStorage.setItem(demoKey,JSON.stringify(rows));
  const money=value=>Number(value||0).toLocaleString('zh-TW',{maximumFractionDigits:0});
  const safeName=value=>String(value||'請款單').replace(/[\\/:*?"<>|]/g,'_');
  const today=()=>new Date().toISOString().slice(0,10);
  const monthNow=()=>today().slice(0,7);
  const missingTable=error=>/community_billing_claims|schema cache|Could not find the table/i.test(error?.message||'');

  async function load(){
    if(useCloud()){
      const[{data:siteRows,error:siteError},{data:claimRows,error:claimError}]=await Promise.all([
        client.from('sites').select('id,code,name,address,community_tax_id,community_phone,status').order('name'),
        client.from('community_billing_claims').select('*').order('issue_date',{ascending:false}).order('created_at',{ascending:false})
      ]);
      if(siteError)throw siteError;
      if(claimError)throw claimError;
      sites=siteRows||[];
      claims=claimRows||[];
    }else{
      const main=JSON.parse(localStorage.getItem('hongjia_erp_demo_v2')||'{}');
      sites=main.sites||[];
      claims=readDemo();
    }
  }

  function calculate(row){
    const fees=['security_fee','property_management_fee','cleaning_fee','equipment_fee','other_fee'].reduce((sum,key)=>sum+Number(row[key]||0),0);
    if(row.tax_mode==='tax_excluded')return{subtotal:fees,tax_amount:Math.round(fees*.05),total_amount:Math.round(fees*1.05)};
    if(row.tax_mode==='tax_included'){const subtotal=Math.round(fees/1.05);return{subtotal,tax_amount:fees-subtotal,total_amount:fees}}
    return{subtotal:fees,tax_amount:0,total_amount:fees};
  }

  async function persist(row,id){
    const site=sites.find(item=>item.id===row.site_id);
    if(!site)throw Error('請選擇請款案場');
    Object.assign(row,{
      site_code:site.code||'',
      community_name:site.name||'',
      community_tax_id:site.community_tax_id||'',
      community_phone:site.community_phone||'',
      community_address:site.address||''
    },calculate(row));
    if(useCloud()){
      const query=id?client.from('community_billing_claims').update(row).eq('id',id):client.from('community_billing_claims').insert(row);
      const{error}=await query;
      if(error)throw error;
      return;
    }
    const rows=readDemo();
    if(id)saveDemo(rows.map(item=>item.id===id?{...item,...row,updated_at:new Date().toISOString()}:item));
    else{
      const sequence=String(rows.length+1).padStart(6,'0');
      saveDemo([{id:crypto.randomUUID(),claim_no:`CLAIM-${sequence}`,...row,created_at:new Date().toISOString()},...rows]);
    }
  }

  async function removeClaim(row){
    if(!confirm(`確定刪除請款單「${row.claim_no||row.community_name}」？刪除後無法復原。`))return;
    if(useCloud()){
      const{error}=await client.from('community_billing_claims').delete().eq('id',row.id);
      if(error)throw error;
    }else saveDemo(readDemo().filter(item=>item.id!==row.id));
    notice('社區請款單已刪除。','success');
    await render();
  }

  function claimBody(row){
    const company=companies[row.issuer_company]||companies.security;
    const items=[
      ['保全服務費',row.security_fee],
      ['物業管理費',row.property_management_fee],
      ['環境清潔費',row.cleaning_fee],
      ['設備／耗材費',row.equipment_fee],
      [row.other_fee_description||'其他費用',row.other_fee]
    ].filter(([,amount])=>Number(amount)>0);
    const taxRows=row.tax_mode==='tax_excluded'
      ?`<tr><th>未稅小計</th><td>NT$ ${money(row.subtotal)}</td></tr><tr><th>營業稅（外加 5%）</th><td>NT$ ${money(row.tax_amount)}</td></tr>`
      :'';
    return`<section class="claim-page">
      <header><h1>${esc(company.name)}</h1><p>統一編號：${esc(company.taxId)}　電話：03-283-0453</p><h2>社區服務費請款單</h2></header>
      <div class="claim-meta"><p><b>請款單號</b>${esc(row.claim_no||'自動編號')}</p><p><b>請款日期</b>${esc(row.issue_date||'')}</p><p><b>請款月份</b>${esc(row.billing_month||'')}</p><p><b>付款期限</b>${esc(row.due_date||'')}</p></div>
      <table class="community"><tr><th>請款對象</th><td>${esc(row.community_name||'')}</td><th>統一編號</th><td>${esc(row.community_tax_id||'—')}</td></tr><tr><th>社區電話</th><td>${esc(row.community_phone||'—')}</td><th>案場代碼</th><td>${esc(row.site_code||'—')}</td></tr><tr><th>社區地址</th><td colspan="3">${esc(row.community_address||'')}</td></tr><tr><th>服務期間</th><td colspan="3">${esc(row.service_period_start||'—')} 至 ${esc(row.service_period_end||'—')}</td></tr></table>
      <table class="items"><thead><tr><th>請款項目</th><th>金額</th></tr></thead><tbody>${items.map(([label,amount])=>`<tr><td>${esc(label)}</td><td>NT$ ${money(amount)}</td></tr>`).join('')}${taxRows}<tr class="total"><th>本期請款總額</th><td>NT$ ${money(row.total_amount)}</td></tr></tbody></table>
      <p class="tax-note">${esc(taxLabels[row.tax_mode]||'')}</p>
      ${row.notes?`<section class="notes"><b>請款備註：</b>${esc(row.notes)}</section>`:''}
      <div class="claim-bottom">
        ${row.payment_bank||row.payment_account_name||row.payment_account_no?`<section class="payment"><h3>匯款資訊</h3><p><span>銀行：${esc(row.payment_bank||'—')}</span><span>戶名：${esc(row.payment_account_name||'—')}</span><span>帳號：${esc(row.payment_account_no||'—')}</span></p></section>`:''}
        <footer><div>經辦：________________</div><div>會計：________________</div><div>公司章：________________</div></footer>
      </div>
    </section>`;
  }

  function documentHtml(rows){
    return`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>社區請款單</title><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"Microsoft JhengHei",sans-serif;color:#142d44;background:#fff}.claim-page{min-height:297mm;padding:12mm;break-after:page}.claim-page:last-child{break-after:auto}header{text-align:center;border-bottom:3px solid #16324f;padding-bottom:12px;margin-bottom:18px}header h1{font-size:22px;margin:0 0 5px}header h2{font-size:27px;letter-spacing:8px;margin:16px 0 3px}header p{margin:0;font-size:12px}.claim-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin-bottom:14px}.claim-meta p{display:grid;grid-template-columns:90px 1fr;margin:0;border-bottom:1px solid #aebdca;padding:6px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #8fa2b3;padding:9px;text-align:left}.community th{width:16%;background:#eef3f6}.items th:last-child,.items td:last-child{text-align:right;width:28%}.items thead th{background:#16324f;color:#fff}.items .total{font-size:18px;background:#edf7f3}.tax-note{text-align:right;color:#526778}.payment,.notes{border:1px solid #aebdca;padding:12px;margin-top:12px}.payment h3{margin:0 0 7px}.payment p{display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;margin:0;white-space:normal}.payment p span:last-child{grid-column:1/-1;overflow-wrap:anywhere}.notes{margin:0;white-space:pre-wrap}.claim-bottom{break-inside:avoid;page-break-inside:avoid}.claim-bottom .payment{break-inside:avoid;page-break-inside:avoid}footer{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:68px;text-align:center;break-inside:avoid;page-break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.claim-page{padding:12mm}}
    </style></head><body>${rows.map(claimBody).join('')}</body></html>`;
  }

  function printClaims(rows){
    if(!rows.length)return notice('請先勾選要列印的請款單。','error');
    const frame=document.createElement('iframe');
    frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:-10000px';
    document.body.appendChild(frame);
    frame.onload=()=>{setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),1500)},250)};
    frame.srcdoc=documentHtml(rows);
  }

  function downloadClaims(rows){
    if(!rows.length)return notice('請先勾選要下載的請款單。','error');
    const blob=new Blob(['\ufeff',documentHtml(rows)],{type:'application/msword'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;
    link.download=rows.length===1?`社區請款單_${safeName(rows[0].community_name)}_${rows[0].billing_month||''}.doc`:`社區請款單_勾選${rows.length}筆_${today()}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notice(`已下載 ${rows.length} 筆社區請款單。`,'success');
  }

  function ensureDialog(){
    let dialog=$('#billingClaimDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='billingClaimDialog';dialog.className='billing-claim-dialog';document.body.appendChild(dialog)}
    return dialog;
  }

  function openEditor(record={}){
    const dialog=ensureDialog(),month=record.billing_month||monthNow(),issue=record.issue_date||today();
    dialog.innerHTML=`<form id="billingClaimForm">
      <div class="dialog-head"><div><p class="eyebrow">社區財務</p><h3>${record.id?'編輯':'新增'}社區請款單</h3></div><button type="button" class="icon-button billing-close">×</button></div>
      <div class="form-grid billing-claim-form">
        <label>請款案場<select name="site_id" required><option value="">請選擇</option>${sites.map(site=>`<option value="${site.id}" ${site.id===record.site_id?'selected':''}>${esc(site.code||'')}－${esc(site.name)}</option>`).join('')}</select></label>
        <label>請款公司<select name="issuer_company"><option value="security" ${record.issuer_company!=='property'?'selected':''}>紘嘉保全股份有限公司</option><option value="property" ${record.issuer_company==='property'?'selected':''}>紘嘉公寓大廈管理維護股份有限公司</option></select></label>
        <label>請款月份<input name="billing_month" type="month" value="${esc(month)}" required></label>
        <label>請款日期<input name="issue_date" type="date" value="${esc(issue)}" required></label>
        <label>付款期限<input name="due_date" type="date" value="${esc(record.due_date||'')}"></label>
        <label>狀態<select name="status">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${record.status===value?'selected':''}>${label}</option>`).join('')}</select></label>
        <label>服務期間開始<input name="service_period_start" type="date" value="${esc(record.service_period_start||'')}"></label>
        <label>服務期間結束<input name="service_period_end" type="date" value="${esc(record.service_period_end||'')}"></label>
        <div class="form-section wide">請款項目</div>
        <label>保全服務費<input name="security_fee" type="number" min="0" step="1" value="${Number(record.security_fee||0)}"></label>
        <label>物業管理費<input name="property_management_fee" type="number" min="0" step="1" value="${Number(record.property_management_fee||0)}"></label>
        <label>環境清潔費<input name="cleaning_fee" type="number" min="0" step="1" value="${Number(record.cleaning_fee||0)}"></label>
        <label>設備／耗材費<input name="equipment_fee" type="number" min="0" step="1" value="${Number(record.equipment_fee||0)}"></label>
        <label>其他費用<input name="other_fee" type="number" min="0" step="1" value="${Number(record.other_fee||0)}"></label>
        <label>其他費用說明<input name="other_fee_description" value="${esc(record.other_fee_description||'')}"></label>
        <fieldset class="tax-add-option wide"><legend>營業稅方式</legend><div class="tax-check-row"><label><input name="tax_mode" type="radio" value="tax_included" ${record.tax_mode!=='tax_excluded'?'checked':''}> 稅內含</label><label><input name="tax_mode" type="radio" value="tax_excluded" ${record.tax_mode==='tax_excluded'?'checked':''}> 稅外加（另加 5%）</label></div></fieldset>
        <div class="billing-total wide" id="billingTotalPreview"></div>
        <div class="form-section wide">匯款資訊（選填）</div>
        <label>銀行<input name="payment_bank" value="${esc(record.payment_bank||'')}"></label>
        <label>戶名<input name="payment_account_name" value="${esc(record.payment_account_name||'')}"></label>
        <label class="wide">帳號<input name="payment_account_no" value="${esc(record.payment_account_no||'')}"></label>
        <label class="wide">請款備註<textarea name="notes">${esc(record.notes||'')}</textarea></label>
      </div>
      <p id="billingClaimMessage" class="form-message"></p>
      <div class="dialog-actions"><button type="button" class="btn ghost billing-close">取消</button><button class="btn primary">儲存請款單</button></div>
    </form>`;
    const form=$('#billingClaimForm'),message=$('#billingClaimMessage'),preview=()=>{
      const values=Object.fromEntries(new FormData(form).entries()),totals=calculate(values);
      $('#billingTotalPreview').innerHTML=values.tax_mode==='tax_excluded'
        ?`未稅小計 <b>NT$ ${money(totals.subtotal)}</b>　營業稅 <b>NT$ ${money(totals.tax_amount)}</b>　請款總額 <strong>NT$ ${money(totals.total_amount)}</strong>`
        :`稅內含　請款總額 <strong>NT$ ${money(totals.total_amount)}</strong>`;
    };
    dialog.querySelectorAll('.billing-close').forEach(button=>button.onclick=()=>dialog.close());
    form.querySelectorAll('input[type="number"],[name="tax_mode"]').forEach(input=>input.oninput=preview);
    preview();
    form.onsubmit=async event=>{
      event.preventDefault();
      const row=Object.fromEntries(new FormData(form).entries());
      for(const key of ['security_fee','property_management_fee','cleaning_fee','equipment_fee','other_fee'])row[key]=Number(row[key]||0);
      if(['security_fee','property_management_fee','cleaning_fee','equipment_fee','other_fee'].every(key=>row[key]<=0)){message.textContent='至少要輸入一項請款費用。';return}
      message.textContent='儲存中…';
      try{await persist(row,record.id);dialog.close();notice('社區請款單已儲存。','success');await render()}
      catch(error){message.textContent=missingTable(error)?'尚未安裝社區請款單資料表，請先執行 migration-community-billing-claims.sql。':`儲存失敗：${error.message}`}
    };
    dialog.showModal();
  }

  function selectedRows(){
    return claims.filter(row=>$(`.billing-row-check[value="${row.id}"]`)?.checked);
  }

  async function render(){
    const host=$('#content');
    try{await load()}
    catch(error){
      host.innerHTML=`<article class="panel empty">${missingTable(error)?'尚未安裝社區請款單資料表，請先執行 migration-community-billing-claims.sql。':`載入失敗：${esc(error.message)}`}</article>`;
      return;
    }
    host.innerHTML=`<article class="panel billing-claims">
      <div class="panel-head"><div><h3>社區請款單</h3><span class="muted">向社區請領保全、物業、清潔及其他服務費用</span></div><div class="action-row"><button class="btn ghost" id="billingPrintSelected">列印勾選請款單</button><button class="btn ghost" id="billingDownloadSelected">下載勾選請款單</button><button class="btn primary" id="billingAdd">＋ 新增請款單</button></div></div>
      <div class="table-wrap"><table><thead><tr><th><input id="billingSelectAll" type="checkbox"></th><th>請款單號</th><th>社區／月份</th><th>請款公司</th><th>請款總額</th><th>付款期限</th><th>狀態</th><th>操作</th></tr></thead><tbody>${claims.length?claims.map(row=>`<tr><td><input class="billing-row-check" type="checkbox" value="${row.id}"></td><td><strong>${esc(row.claim_no||'自動編號')}</strong><small>${esc(row.issue_date||'')}</small></td><td><strong>${esc(row.community_name||'')}</strong><small>${esc(row.billing_month||'')}</small></td><td>${esc((companies[row.issuer_company]||companies.security).name)}</td><td><strong>NT$ ${money(row.total_amount)}</strong><small>${esc(taxLabels[row.tax_mode]||'')}</small></td><td>${esc(row.due_date||'—')}</td><td><span class="badge ${row.status==='cancelled'?'warning':''}">${esc(statusLabels[row.status]||row.status)}</span></td><td><div class="action-row"><button class="mini-button" data-billing-edit="${row.id}">編輯</button><button class="mini-button" data-billing-print="${row.id}">列印</button><button class="mini-button" data-billing-download="${row.id}">下載</button><button class="mini-button danger" data-billing-delete="${row.id}">刪除</button></div></td></tr>`).join(''):'<tr><td colspan="8" class="empty">尚無社區請款單，請從右上方新增。</td></tr>'}</tbody></table></div>
    </article>`;
    $('#billingAdd').onclick=()=>openEditor();
    $('#billingSelectAll').onchange=event=>$$('.billing-row-check').forEach(input=>input.checked=event.target.checked);
    $('#billingPrintSelected').onclick=()=>printClaims(selectedRows());
    $('#billingDownloadSelected').onclick=()=>downloadClaims(selectedRows());
    $$('[data-billing-edit]').forEach(button=>button.onclick=()=>openEditor(claims.find(row=>row.id===button.dataset.billingEdit)));
    $$('[data-billing-print]').forEach(button=>button.onclick=()=>printClaims([claims.find(row=>row.id===button.dataset.billingPrint)]));
    $$('[data-billing-download]').forEach(button=>button.onclick=()=>downloadClaims([claims.find(row=>row.id===button.dataset.billingDownload)]));
    $$('[data-billing-delete]').forEach(button=>button.onclick=async()=>{try{await removeClaim(claims.find(row=>row.id===button.dataset.billingDelete))}catch(error){notice(`刪除失敗：${error.message}`,'error')}});
  }

  window.BillingClaims={configure(options={}){if(options.notice)notice=options.notice},render};
})();
