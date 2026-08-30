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
  const rocDate=value=>{const parts=String(value||'').split('-').map(Number);return parts.length===3&&parts.every(Number.isFinite)?`${parts[0]-1911}年${parts[1]}月${parts[2]}日`:String(value||'')};
  const monthLabel=value=>{const parts=String(value||'').split('-').map(Number);return parts.length===2&&parts.every(Number.isFinite)?`${parts[0]-1911}年${parts[1]}月份`:String(value||'')};
  function chineseAmount(value){
    const digits='零壹貳參肆伍陸柒捌玖',smallUnits=['','拾','佰','仟'],sectionUnits=['','萬','億','兆'];
    const sectionText=section=>{let result='',unit=0,zero=false;while(section>0){const digit=section%10;if(digit===0){if(result&&!zero){result=`零${result}`;zero=true}}else{result=`${digits[digit]}${smallUnits[unit]}${result}`;zero=false}section=Math.floor(section/10);unit++}return result.replace(/零+$/,'')};
    let number=Math.max(0,Math.floor(Number(value)||0));if(number===0)return'新臺幣零元整';let result='',sectionIndex=0,needZero=false;
    while(number>0){const section=number%10000;if(section){const text=sectionText(section);result=`${text}${sectionUnits[sectionIndex]}${needZero?'零':''}${result}`;needZero=section<1000}else if(result)needZero=true;number=Math.floor(number/10000);sectionIndex++}
    return`新臺幣${result.replace(/零+/g,'零').replace(/零$/,'')}元整`;
  }

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

  function claimCopy(row,copyLabel){
    const company=companies[row.issuer_company]||companies.security;
    const items=[
      ['保全服務費',row.security_fee],
      ['物業管理費',row.property_management_fee],
      ['環境清潔費',row.cleaning_fee],
      ['設備／耗材費',row.equipment_fee],
      [row.other_fee_description||'其他費用',row.other_fee]
    ].filter(([,amount])=>Number(amount)>0);
    const taxRows=row.tax_mode==='tax_excluded'?`<tr><th>金額</th><td><span>NT$</span><strong>${money(row.subtotal)}</strong></td></tr><tr><th>5% 稅金</th><td><span>NT$</span><strong>${money(row.tax_amount)}</strong></td></tr>`:'';
    const itemText=items.map(([label,amount])=>`<li><span>${esc(label)}</span><strong>NT$ ${money(amount)}</strong></li>`).join('');
    const period=row.service_period_start||row.service_period_end?`${esc(row.service_period_start||'—')} 至 ${esc(row.service_period_end||'—')}`:esc(monthLabel(row.billing_month)||'—');
    return`<article class="claim-copy">
      <div class="claim-main">
        <header><h1>${esc(company.name)}</h1><div class="title-row"><h2>服 務 單</h2><time>${esc(rocDate(row.issue_date))}</time></div><p>統一編號：${esc(company.taxId)}　電話：03-283-0453　請款單號：${esc(row.claim_no||'自動編號')}${row.due_date?`　付款期限：${esc(rocDate(row.due_date))}`:''}</p></header>
        <table class="service-form"><tbody>
          <tr class="amount-row"><th>申請款額</th><td><div class="amount-value"><strong>${esc(chineseAmount(row.total_amount))}</strong><span>NT$ ${money(row.total_amount)}</span></div></td></tr>
          <tr class="summary-row"><th>摘　要</th><td><div class="summary-info"><p><b>公司名稱：</b>${esc(row.community_name||'')}</p><p><b>服務標的：</b>${esc(row.community_name||'')}</p><p><b>服務期間：</b>${period}</p><p><b>請款月份：</b>${esc(monthLabel(row.billing_month)||'—')}</p></div><ul class="item-list">${itemText}</ul><table class="amount-summary"><tbody>${taxRows}<tr class="total"><th>總計</th><td><span>NT$</span><strong>${money(row.total_amount)}</strong></td></tr></tbody></table><small class="tax-note">${esc(taxLabels[row.tax_mode]||'')}</small></td></tr>
          <tr class="remarks-row"><th>備　註</th><td>${row.notes?`<p class="claim-notes">${esc(row.notes)}</p>`:''}<div class="payment"><p><b>匯款帳戶：</b>${esc(row.payment_account_name||company.name)}</p><p><b>匯款銀行：</b>${esc(row.payment_bank||'—')}　<b>帳號：</b>${esc(row.payment_account_no||'—')}</p></div></td></tr>
        </tbody></table>
        <footer><div><b>業務承辦人簽章</b></div><div><b>會計覆核</b></div><div class="company-stamp"><b>公司確認章</b></div></footer>
      </div>
      <strong class="copy-label">${esc(copyLabel)}</strong>
    </article>`;
  }

  function claimBody(row){
    return`<section class="claim-page">${claimCopy(row,'收執聯')}<div class="cut-line"><span>✂</span></div>${claimCopy(row,'存根聯')}</section>`;
  }

  function documentHtml(rows){
    return`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>社區請款單</title><style>
      @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;width:210mm;background:#fff;color:#111;font-family:"DFKai-SB","BiauKai","Microsoft JhengHei",sans-serif}body{font-size:11.5px}.claim-page{width:210mm;height:297mm;padding:4mm 8mm;overflow:hidden;break-after:page}.claim-page:last-child{break-after:auto}.claim-copy{height:140.5mm;display:grid;grid-template-columns:minmax(0,1fr) 9mm;overflow:hidden;border:1.8px solid #000}.claim-main{min-width:0;display:flex;flex-direction:column}.claim-main>header{flex:0 0 auto;padding:1mm 2mm 1.8mm;text-align:center;border-bottom:1.8px solid #000}.claim-main>header h1{margin:0;font-size:20px;letter-spacing:2px}.title-row{position:relative;margin-top:2px}.title-row h2{margin:0;font-size:19px;letter-spacing:7px}.title-row time{position:absolute;right:2mm;bottom:1px;font-size:12px;font-weight:700}.claim-main>header>p{margin:3px 0 0;font-size:10.5px;letter-spacing:.2px}.copy-label{align-self:stretch;display:flex;align-items:center;justify-content:center;border:0;border-left:1.8px solid #000;font-size:15px;letter-spacing:5px;writing-mode:vertical-rl;text-orientation:upright}.service-form{width:100%;height:86mm;border-collapse:collapse;table-layout:fixed;margin:-1.8px 0 0 -1.8px;width:calc(100% + 1.8px)}.service-form th,.service-form td{border:1.8px solid #000}.service-form>tbody>tr>th{width:26mm;padding:2mm;text-align:center;font-size:15px;letter-spacing:2px}.service-form>tbody>tr>td{padding:2mm 2.5mm}.amount-row{height:14mm}.amount-row td{height:14mm;font-size:15px}.amount-value{display:flex;align-items:center;justify-content:space-between;gap:8px}.amount-value>strong{letter-spacing:4px}.amount-value>span{white-space:nowrap;font-family:"Microsoft JhengHei",sans-serif;font-weight:800}.summary-row{height:55mm}.summary-row>td{position:relative;vertical-align:top}.summary-info{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;font-size:12.5px}.summary-info p{margin:0;line-height:1.45;border-bottom:1px solid #000;padding-bottom:1px}.summary-info p:first-child,.summary-info p:nth-child(2){grid-column:1/-1}.item-list{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin:4px 0 3px;padding:0;list-style:none;font-family:"Microsoft JhengHei",sans-serif;font-size:11.5px}.item-list li{display:flex;justify-content:space-between;gap:6px;border-bottom:1.2px solid #000}.item-list strong{white-space:nowrap}.amount-summary{width:58%;margin:2px 0 0 auto;border-collapse:collapse;font-family:"Microsoft JhengHei",sans-serif;font-size:11.5px}.amount-summary th,.amount-summary td{border:1.6px solid #000;padding:2px 5px}.amount-summary th{width:55%;text-align:right}.amount-summary td{text-align:right}.amount-summary td span{float:left}.amount-summary .total{font-size:13px}.tax-note{display:block;margin-top:2px;text-align:right;font-family:"Microsoft JhengHei",sans-serif;font-size:10px}.remarks-row{height:17mm}.remarks-row td{vertical-align:top}.claim-notes{margin:0 0 3px;white-space:pre-wrap;font-size:11px}.payment{display:grid;grid-template-columns:1fr 1.35fr;gap:1px 12px;font-size:12px;line-height:1.4}.payment p{margin:0}.payment p:first-child,.payment p:nth-child(2){grid-column:1/-1}.payment p:nth-child(2){white-space:nowrap}.claim-main>footer{flex:1 1 auto;min-height:25mm;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:-1.8px 0 0 -1.8px}.claim-main>footer>div{min-width:0;border:1.8px solid #000;padding:2.5mm;font-size:12.5px}.claim-main>footer>div+div{border-left:0}.company-stamp{min-width:0}.cut-line{height:8mm;border-top:1px dashed #555;position:relative}.cut-line span{position:absolute;top:-8px;left:2mm;padding:0 3px;background:#fff;color:#555}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
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

  window.BillingClaims={configure(options={}){if(options.notice)notice=options.notice},render,previewHtml:documentHtml};
})();
