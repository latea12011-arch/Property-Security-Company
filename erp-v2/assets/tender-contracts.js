(()=>{'use strict';
const cfg=window.ERP_CONFIG||{},cloud=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase),client=cloud?(window.ERP_CLIENT||(window.ERP_CLIENT=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey))):null,useCloud=()=>cloud&&!window.ERP_DEMO_MODE;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=v=>Number(v||0).toLocaleString('zh-TW',{maximumFractionDigits:0});
const demoKey='hongjia_tender_contracts_demo',quoteDemoKey='hongjia_tender_quotes_demo',logoPath='assets/contracts/hongjia-property-mark.png',lineQrPath='assets/contracts/hongjia-line-official-qr.png',lineOfficialUrl='https://lin.ee/XUE5xg6';
const types={property:'公寓大廈管理維護勞務合約書',security:'駐衛保全服務勞務合約書'};
const companies={
  property:{name:'紘嘉公寓大廈管理維護股份有限公司',taxId:'70409141',phone:'03-283-0453',address:'桃園市八德區高城里高城路23號1樓'},
  security:{name:'紘嘉保全股份有限公司',taxId:'94012985',phone:'03-283-0453',address:'桃園市八德區高城里高城路23號1樓'}
};
const statuses={draft:'草稿',attached:'隨報價附送',signed:'已簽約',active:'履約中',expired:'已到期',cancelled:'已取消'};
const securityRoles=new Set(['guard_day','guard_night','guard_mobile']);
const equipmentOptions=['火警系統','閉路電視監視系統','錄影設備','緊急廣播系統','對講機系統','門禁管制系統','巡邏感應系統'];
const expenseOptions=['水電費','電話費','飲水設備','辦公桌椅及照明','警備及消防設備'];
let rows=[],quotes=[],logoDataUrl='',lineQrDataUrl='';
const demo=()=>{try{return JSON.parse(localStorage.getItem(demoKey))||[]}catch(_){return[]}},saveDemo=x=>localStorage.setItem(demoKey,JSON.stringify(x));
const quoteDemo=()=>{try{return JSON.parse(localStorage.getItem(quoteDemoKey))||[]}catch(_){return[]}};
const companyFor=type=>companies[type]||companies.property;
const detailsOf=row=>{if(!row?.formal_details)return{};if(typeof row.formal_details==='object')return row.formal_details;try{return JSON.parse(row.formal_details)}catch(_){return{}}};
const defaultDetails=()=>({
  client_title:'主任委員',client_phone:'',client_tax_id:'',service_time:'07:00～19:00',
  bank_name:'',bank_branch:'',bank_account_name:'',bank_account_no:'',
  equipment:['火警系統','閉路電視監視系統','錄影設備','緊急廣播系統','對講機系統'],
  expenses:['水電費','電話費','飲水設備','辦公桌椅及照明','警備及消防設備'],
  liability_cap:200000,claim_notice_hours:24,claim_document_days:15,
  termination_notice_days:14,long_term_notice_days:60,jurisdiction:'臺灣桃園地方法院',
  company_representative:'',signing_date:'',staffing_note:'',attachment_services:defaultAttachment()
});
function mergeDetails(row){return{...defaultDetails(),...detailsOf(row)}}
function defaultAttachment(){return`一、人力配置及值勤時段：
（一）依本合約人力明細及排班表執行。
（二）值勤時段依案場需求、報價單及雙方書面約定辦理。

二、服務內容：
（一）門廳管制、訪客及車輛人員登記管理。
（二）郵件收發登記及緊急突發狀況處理。
（三）公共照明、門禁及巡邏點之例行檢查。
（四）協助公共區域秩序維護與異常狀況回報。

三、工作職掌：
（一）值勤時保持禮貌、警覺及服裝儀容整齊。
（二）施工、仲介及外來人員應確實登記，無關人員不得逗留。
（三）發現設備或公設損壞時，應記錄並立即回報。
（四）遇緊急事件時立即通報社區經理、管理委員會及相關機關。`}
function defaultScope(type){return type==='security'
  ?'門禁管制、訪客與車輛登記、巡邏、監視設備注意、緊急事件通報及雙方約定之駐衛保全服務。'
  :'社區行政、總幹事、秘書、清潔、機電協調、公共事務及雙方約定之公寓大廈管理維護服務。'}
function defaultTerms(){return'本契約未盡事宜，依公寓大廈管理條例、保全業法、民法及其他相關法令與誠信公平原則辦理。雙方另有書面約定者，視為本契約之一部分。'}
async function listContracts(){if(!useCloud())return demo();const{data,error}=await client.from('tender_contracts').select('*,tender_quotations(quote_no)').order('created_at',{ascending:false});if(error)throw error;return data||[]}
async function listQuotes(){if(!useCloud())return quoteDemo();const{data,error}=await client.from('tender_quotations').select('*').order('quote_date',{ascending:false});if(error)throw error;return data||[]}
async function quoteItems(id){if(!id)return[];if(!useCloud())return quoteDemo().find(x=>x.id===id)?.items||[];const{data,error}=await client.from('tender_quotation_items').select('*').eq('quotation_id',id).order('sort_order');if(error)throw error;return data||[]}
async function contractItems(id){if(!id)return[];if(!useCloud())return demo().find(x=>x.id===id)?.items||[];const{data,error}=await client.from('tender_contract_items').select('*').eq('contract_id',id).order('sort_order');if(error)throw error;return data||[]}
function ensureDialog(){let d=$('#tenderContractDialog');if(d)return d;d=document.createElement('dialog');d.id='tenderContractDialog';document.body.appendChild(d);return d}
function itemUnit(x){return Number(x.unit_monthly_cost||0)||['monthly_salary','labor_insurance','health_insurance','pension_contribution','group_insurance','overtime_allowance','equipment_uniform','other_monthly_cost'].reduce((n,k)=>n+Number(x[k]||0),0)}
function workText(role){if(securityRoles.has(role))return'門禁、巡邏、監視及緊急事件通報';if(role==='cleaner')return'公共區域清潔、垃圾分類及環境維護';if(role==='manager')return'社區行政、會議、財務及廠商管理';if(role==='secretary')return'櫃檯、文書、收發及行政協助';if(role==='electromechanical')return'機電設備巡檢、異常通報與廠商協調';return'依勞務需求及雙方約定執行'}
function relevantItems(items,type){const filtered=items.filter(x=>type==='security'?securityRoles.has(x.role_type):!securityRoles.has(x.role_type));return filtered.length?filtered:items}
function fromQuoteItems(items,type){return relevantItems(items,type).map((x,i)=>({source_quotation_item_id:x.id||null,sort_order:i,role_type:x.role_type||'other',role_name:x.role_name||'服務人員',headcount:Number(x.headcount||1),unit_monthly_amount:itemUnit(x),work_description:workText(x.role_type)}))}
function itemHtml(x={}){return`<div class="contract-line"><input class="c-role" value="${esc(x.role_name||'服務人員')}" placeholder="職務"><input class="c-head" type="number" min="0.5" step="0.5" value="${Number(x.headcount||1)}" title="人數"><input class="c-unit" type="number" min="0" step="1" value="${Number(x.unit_monthly_amount||0)}" title="每人每月金額"><strong class="c-total">$0</strong><input class="c-work" value="${esc(x.work_description||'')}" placeholder="工作內容"><input class="c-type" type="hidden" value="${esc(x.role_type||'other')}"><input class="c-source" type="hidden" value="${esc(x.source_quotation_item_id||'')}"><button type="button" class="mini-button danger c-remove">刪除</button></div>`}
function collect(){return $$('.contract-line').map((line,i)=>{const head=Number(line.querySelector('.c-head').value||0),unit=Number(line.querySelector('.c-unit').value||0);return{source_quotation_item_id:line.querySelector('.c-source').value||null,sort_order:i,role_type:line.querySelector('.c-type').value||'other',role_name:line.querySelector('.c-role').value.trim(),headcount:head,unit_monthly_amount:unit,line_monthly_total:head*unit,work_description:line.querySelector('.c-work').value.trim()}})}
function ensureContractTaxMode(){const f=$('#tenderContractForm');if(!f||f.tax_mode||!f.tax_rate)return;f.tax_rate.closest('label').insertAdjacentHTML('beforebegin','<label>課稅方式<select name="tax_mode"><option value="tax_included">稅內含（輸入含稅總額）</option><option value="tax_excluded">稅外加（未稅金額另加營業稅）</option><option value="tax_exempt">免稅</option></select></label>');const stored=rows.find(x=>x.contract_no===f.contract_no?.value);f.tax_mode.value=stored?.tax_mode||'tax_included';f.tax_mode.onchange=calculate}
function calculate(){ensureContractTaxMode();const items=collect(),entered=items.reduce((n,x)=>n+x.line_monthly_total,0),f=$('#tenderContractForm'),rate=Number(f?.tax_rate?.value||0)/100,mode=f?.tax_mode?.value||'tax_included';let subtotal=entered,tax=0,total=entered;if(mode==='tax_excluded'){tax=subtotal*rate;total=subtotal+tax}else if(mode==='tax_included'&&rate>0){subtotal=entered/(1+rate);tax=entered-subtotal}$$('.contract-line').forEach((line,i)=>line.querySelector('.c-total').textContent=`$${money(items[i].line_monthly_total)}`);const el=$('#contractTotals');if(el)el.innerHTML=`<span>未稅月費 <b>$${money(subtotal)}</b></span><span>${mode==='tax_excluded'?'稅外加':mode==='tax_included'?'稅內含':'免稅'} <b>$${money(tax)}</b></span><span>含稅每月服務費 <b>$${money(total)}</b></span>`;return{subtotal,tax,total}}
function bindLines(){$$('.contract-line').forEach(line=>{line.querySelectorAll('input').forEach(x=>x.oninput=calculate);line.querySelector('.c-remove').onclick=()=>{line.remove();calculate()}});calculate()}
function renderItems(items){$('#contractLines').innerHTML=(items.length?items:[{role_name:'服務人員',headcount:1,unit_monthly_amount:0}]).map(itemHtml).join('');bindLines()}
function chooseType(items){const guards=items.filter(x=>securityRoles.has(x.role_type)).length;return guards&&guards===items.length?'security':'property'}
function checkGrid(name,options,selected){return`<fieldset class="check-field wide"><legend>${name==='equipment'?'甲方提供之設備（可複選）':'甲方負擔之現場費用（可複選）'}</legend><div class="check-grid">${options.map(x=>`<label class="check-option"><input type="checkbox" data-detail-check="${name}" value="${esc(x)}" ${selected.includes(x)?'checked':''}>${esc(x)}</label>`).join('')}</div></fieldset>`}
function collectDetails(){const val=name=>$(`[name="${name}"]`)?.value.trim()||'',num=name=>Number(val(name)||0),checked=name=>$$(`[data-detail-check="${name}"]:checked`).map(x=>x.value);return{
  client_title:val('client_title'),client_phone:val('client_phone'),client_tax_id:val('client_tax_id'),service_time:val('service_time'),
  bank_name:val('bank_name'),bank_branch:val('bank_branch'),bank_account_name:val('bank_account_name'),bank_account_no:val('bank_account_no'),
  equipment:checked('equipment'),expenses:checked('expenses'),liability_cap:num('liability_cap'),claim_notice_hours:num('claim_notice_hours'),
  claim_document_days:num('claim_document_days'),termination_notice_days:num('termination_notice_days'),long_term_notice_days:num('long_term_notice_days'),
  jurisdiction:val('jurisdiction'),company_representative:val('company_representative'),signing_date:val('signing_date'),
  staffing_note:val('staffing_note'),attachment_services:val('attachment_services')
}}
async function syncQuoteToForm(quoteId,forceType){const quote=quotes.find(x=>x.id===quoteId),detail=await quoteItems(quoteId);if(!quote)return;const f=$('#tenderContractForm'),type=forceType||f.contract_type.value||chooseType(detail);ensureContractTaxMode();f.contract_type.value=type;f.company_name.value=companyFor(type).name;f.client_name.value=quote.client_name||'';f.project_name.value=quote.project_name||'';f.site_address.value=quote.site_address||'';f.contract_start_date.value=quote.contract_start_date||'';f.contract_end_date.value=quote.contract_end_date||'';f.contract_months.value=quote.contract_months||12;f.tax_rate.value=quote.tax_rate??5;f.tax_mode.value=quote.tax_mode||'tax_included';if(!f.service_scope.value)f.service_scope.value=defaultScope(type);renderItems(fromQuoteItems(detail,type))}
async function open(row=null,quotationId=null){quotes=quotes.length?quotes:await listQuotes();const stored=row?await contractItems(row.id):[],initialQuote=quotationId||row?.quotation_id||'',quoteDetail=initialQuote?await quoteItems(initialQuote):[],initialType=row?.contract_type||chooseType(quoteDetail),detail=mergeDetails(row),today=new Date().toLocaleDateString('en-CA'),company=companyFor(initialType),d=ensureDialog();
  d.innerHTML=`<form id="tenderContractForm"><div class="dialog-head"><div><p class="eyebrow">業務與競標</p><h3>${row?'編輯':'新增'}正式勞務合約</h3></div><button type="button" class="icon-button" id="closeContract">×</button></div>
  <div class="form-grid contract-form-grid">
    <label>連結報價單<select name="quotation_id"><option value="">不連結報價單</option>${quotes.map(q=>`<option value="${q.id}" ${q.id===initialQuote?'selected':''}>${esc(q.quote_no)}－${esc(q.client_name)}－${esc(q.project_name)}</option>`).join('')}</select></label>
    <label>合約類型<select name="contract_type"><option value="property" ${initialType==='property'?'selected':''}>物業管理維護</option><option value="security" ${initialType==='security'?'selected':''}>駐衛保全服務</option></select></label>
    <label>合約編號<input name="contract_no" required value="${esc(row?.contract_no||`C-${initialType==='security'?'S':'P'}-${today.replace(/-/g,'')}-${String(Date.now()).slice(-4)}`)}"></label>
    <label>承包廠商<input name="company_name" readonly value="${esc(company.name)}"></label>
    <label>委託單位／管委會<input name="client_name" required value="${esc(row?.client_name||'')}"></label>
    <label>甲方代表人<input name="client_representative" value="${esc(row?.client_representative||'')}"></label>
    <label>甲方代表職稱<input name="client_title" value="${esc(detail.client_title)}"></label>
    <label>甲方電話<input name="client_phone" value="${esc(detail.client_phone)}"></label>
    <label>甲方統編<input name="client_tax_id" inputmode="numeric" maxlength="8" value="${esc(detail.client_tax_id)}"></label>
    <label>勞務名稱<input name="project_name" required value="${esc(row?.project_name||'')}"></label>
    <label class="wide">執勤地點／標的地址<input name="site_address" value="${esc(row?.site_address||'')}"></label>
    <label>合約開始<input name="contract_start_date" type="date" value="${row?.contract_start_date||''}"></label>
    <label>合約結束<input name="contract_end_date" type="date" value="${row?.contract_end_date||''}"></label>
    <label>合約月數<input name="contract_months" type="number" min="1" value="${row?.contract_months||12}"></label>
    <label>值勤時段<input name="service_time" value="${esc(detail.service_time)}" placeholder="例如 07:00～19:00"></label>
    <label>每月付款期限（日）<input name="payment_due_day" type="number" min="1" max="31" value="${row?.payment_due_day||10}"></label>
    <label>營業稅率（%）<input name="tax_rate" type="number" min="0" step="0.1" value="${row?.tax_rate??5}"></label>
    <label>合約狀態<select name="status">${Object.entries(statuses).map(([v,t])=>`<option value="${v}" ${v===(row?.status||'draft')?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>乙方負責人<input name="company_representative" value="${esc(detail.company_representative)}"></label>
    <label>匯款銀行<input name="bank_name" value="${esc(detail.bank_name)}"></label>
    <label>分行<input name="bank_branch" value="${esc(detail.bank_branch)}"></label>
    <label>戶名<input name="bank_account_name" value="${esc(detail.bank_account_name)}"></label>
    <label>帳號<input name="bank_account_no" value="${esc(detail.bank_account_no)}"></label>
    <label>損害賠償上限<input name="liability_cap" type="number" min="0" value="${detail.liability_cap}"></label>
    <label>事故通報時限（小時）<input name="claim_notice_hours" type="number" min="1" value="${detail.claim_notice_hours}"></label>
    <label>證明文件提出期限（日）<input name="claim_document_days" type="number" min="1" value="${detail.claim_document_days}"></label>
    <label>一般終止預告（日）<input name="termination_notice_days" type="number" min="1" value="${detail.termination_notice_days}"></label>
    <label>一年以上合約預告（日）<input name="long_term_notice_days" type="number" min="1" value="${detail.long_term_notice_days}"></label>
    <label>管轄法院<input name="jurisdiction" value="${esc(detail.jurisdiction)}"></label>
    <label>簽約日期<input name="signing_date" type="date" value="${esc(detail.signing_date)}"></label>
    ${checkGrid('equipment',equipmentOptions,detail.equipment||[])}
    ${checkGrid('expenses',expenseOptions,detail.expenses||[])}
    <label class="wide">服務範圍摘要<textarea name="service_scope">${esc(row?.service_scope||defaultScope(initialType))}</textarea></label>
    <label class="wide">人力配置補充說明<textarea name="staffing_note">${esc(detail.staffing_note)}</textarea></label>
    <label class="wide">附件一－服務內容與工作職掌<textarea name="attachment_services" class="contract-terms">${esc(detail.attachment_services)}</textarea></label>
    <label class="wide">補充合約條款<textarea name="contract_terms" class="contract-terms">${esc(row?.contract_terms||defaultTerms())}</textarea></label>
    <label class="wide">內部備註（不列印）<textarea name="note">${esc(row?.note||'')}</textarea></label>
  </div>
  <div class="tender-head"><h4>人力配置與每月費用</h4><div class="action-row"><button type="button" class="mini-button" id="syncContractQuote">重新從報價單帶入</button><button type="button" class="mini-button" id="addContractLine">＋ 新增人力</button></div></div>
  <div class="contract-labels">職務／人數／每人每月金額／小計／工作內容</div><div id="contractLines"></div><div id="contractTotals" class="tender-totals"></div>
  <p class="contract-legal-note">固定公司名稱、地址、電話與統編會依合約類型自動帶入；案場、期限、費用、設備及簽約資料請依個案確認後填寫。正式簽署前仍建議由法律專業人員複核。</p>
  <p id="contractMessage" class="form-message"></p><div class="dialog-actions"><button type="button" class="btn ghost" id="cancelContract">取消</button><button class="btn primary" type="submit">儲存合約</button></div></form>`;
  d.showModal();$('#closeContract').onclick=$('#cancelContract').onclick=()=>d.close();renderItems(stored.length?stored:fromQuoteItems(quoteDetail,initialType));
  const f=$('#tenderContractForm');f.quotation_id.onchange=async e=>{if(e.target.value)await syncQuoteToForm(e.target.value)};f.contract_type.onchange=async e=>{const type=e.target.value;f.company_name.value=companyFor(type).name;f.service_scope.value=defaultScope(type);if(f.quotation_id.value)await syncQuoteToForm(f.quotation_id.value,type);const prefix=type==='security'?'C-S-':'C-P-';if(/^C-[PS]-/.test(f.contract_no.value))f.contract_no.value=f.contract_no.value.replace(/^C-[PS]-/,prefix)};f.tax_rate.oninput=calculate;
  $('#syncContractQuote').onclick=async()=>{if(!f.quotation_id.value)return $('#contractMessage').textContent='請先選擇報價單。';await syncQuoteToForm(f.quotation_id.value,f.contract_type.value);$('#contractMessage').textContent='已重新帶入報價單的人力、日期與費用。'};
  $('#addContractLine').onclick=()=>{$('#contractLines').insertAdjacentHTML('beforeend',itemHtml({}));bindLines()};f.onsubmit=e=>save(e,row?.id||null);if(!row&&initialQuote)await syncQuoteToForm(initialQuote,initialType)
}
async function save(event,id){event.preventDefault();const f=event.currentTarget,header=Object.fromEntries(new FormData(f).entries()),items=collect(),msg=$('#contractMessage'),details=collectDetails();header.formal_details=JSON.stringify(details);if(details.client_tax_id&&!/^\d{8}$/.test(details.client_tax_id)){msg.textContent='甲方統編請輸入 8 位數字。';return}if(!items.length||items.some(x=>!x.role_name||x.headcount<=0||x.unit_monthly_amount<0)){msg.textContent='請確認至少有一筆正確的人力與費用資料。';return}msg.textContent='儲存中…';try{if(useCloud()){const{error}=await client.rpc('save_tender_contract',{target_id:id,header,items});if(error)throw error}else{const all=demo(),tot=calculate(),record={id:id||crypto.randomUUID(),...header,formal_details:details,company_name:companyFor(header.contract_type).name,monthly_subtotal:tot.subtotal,monthly_tax:tot.tax,monthly_total:tot.total,items};saveDemo(id?all.map(x=>x.id===id?record:x):[record,...all])}ensureDialog().close();await render()}catch(error){msg.textContent=/formal_details|schema cache/i.test(error.message||'')?'資料庫尚未安裝正式合約更新，請先執行 migration-formal-service-contract.sql。':`儲存失敗：${error.message}`}}
function rocDate(value){if(!value)return'中華民國　　年　　月　　日';const d=new Date(`${value}T00:00:00`);return`中華民國 ${d.getFullYear()-1911} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日`}
function checkedList(options,selected){return options.map(x=>`<span class="box">${(selected||[]).includes(x)?'☑':'☐'} ${esc(x)}</span>`).join('')}
function article(no,title,body){return`<section class="article"><h3>第${no}條　${esc(title)}</h3><div>${body}</div></section>`}
function paragraphs(text){return String(text||'').split(/\n+/).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('')}
async function loadLogo(){if(logoDataUrl)return logoDataUrl;try{const blob=await fetch(logoPath).then(r=>{if(!r.ok)throw new Error('logo');return r.blob()});logoDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}catch(_){logoDataUrl=logoPath}return logoDataUrl}
async function loadLineQr(){if(lineQrDataUrl)return lineQrDataUrl;try{const blob=await fetch(lineQrPath).then(r=>{if(!r.ok)throw new Error('line-qr');return r.blob()});lineQrDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}catch(_){lineQrDataUrl=lineQrPath}return lineQrDataUrl}
async function buildContractDocument(row,items){const d=mergeDetails(row),company=companyFor(row.contract_type),[logo,lineQr]=await Promise.all([loadLogo(),loadLineQr()]),typeName=types[row.contract_type]||types.property,start=row.contract_start_date||'____年____月____日',end=row.contract_end_date||'____年____月____日',monthly=money(row.monthly_total),subtotal=money(row.monthly_subtotal),tax=money(row.monthly_tax),taxMode=row.tax_mode||'tax_included',taxText=taxMode==='tax_excluded'?`每月未稅服務費新臺幣 <b>${subtotal}</b> 元，營業稅外加新臺幣 <b>${tax}</b> 元，含稅合計新臺幣 <b>${monthly}</b> 元整。`:taxMode==='tax_exempt'?`每月免稅服務費新臺幣 <b>${monthly}</b> 元整。`:`每月含稅服務費新臺幣 <b>${monthly}</b> 元整（其中營業稅新臺幣 <b>${tax}</b> 元）。`,terms=row.contract_terms||defaultTerms(),equipment=checkedList(equipmentOptions,d.equipment),expenses=checkedList(expenseOptions,d.expenses),staffRows=items.map(x=>`<tr><td>${esc(x.role_name)}</td><td>${esc(x.headcount)}</td><td>${esc(x.work_description||'')}</td><td>${money(x.unit_monthly_amount)}</td><td>${money(x.line_monthly_total||Number(x.headcount)*Number(x.unit_monthly_amount))}</td></tr>`).join('');
  const articles=[
    article('一','對消費者之說明義務',`<p>為維護雙方權益，乙方應向甲方說明本契約主要條款及執行本契約所應負之責任，雙方確認後簽訂本契約。</p>`),
    article('二','管理維護服務之標的物',`<p>名稱：${esc(row.client_name||'________________')}</p><p>地址：${esc(row.site_address||'________________')}</p><p>範圍：甲方共用部分、約定共用部分及雙方書面約定之服務區域。</p>`),
    article('三','受任管理維護及駐衛保全義務',`<p>乙方應依本契約、附件、報價單及雙方書面約定提供服務，並對甲方說明各項安全配合與防範注意事項。乙方及其人員對執勤所知悉之秘密不得洩漏。</p>`),
    article('四','服務作業',`<p>乙方依甲方合理要求執行門禁、車輛登記、巡邏、監視、異常通報及防災建議；遇意外、竊盜、侵入或暴力事件時，應立即通報警察、消防機關及甲方。甲方指示不得牴觸法令，乙方於標的物執行公務警察之巡邏或會哨時，甲方不得無故限制。</p>`),
    article('五','服務期間',`<p>自 ${esc(start)} 起至 ${esc(end)} 止，共 ${esc(row.contract_months||12)} 個月。值勤時段：${esc(d.service_time||'依排班表及雙方約定')}；國定假日是否值勤，依排班表、報價單及雙方書面約定辦理。</p>`),
    article('六','服務費用及付款方式',`<p>${taxText}甲方應於次月 ${esc(row.payment_due_day||10)} 日前，以匯款或雙方指定方式支付。</p><p>銀行：${esc(d.bank_name||'________________')}　分行：${esc(d.bank_branch||'________________')}</p><p>戶名：${esc(d.bank_account_name||company.name)}　帳號：${esc(d.bank_account_no||'________________')}</p><p>如遇基本工資、法令或必要人事成本重大調整，雙方得以書面協議調整服務費。甲方逾期未繳，經催告仍未於十日內繳付者，乙方得依法終止契約。</p>`),
    article('七','作業空間、設備及費用',`<p>甲方應提供適當執勤處所及必要用具。甲方提供設備如下：</p><div class="boxes">${equipment}</div><p>甲方負擔之現場費用如下：</p><div class="boxes">${expenses}</div><p>除另有書面約定外，乙方人員制服及執勤所需個人裝備由乙方提供。</p>`),
    article('八','服務人員紀律',`<p>乙方人員應依企劃與勤務準則執行，值勤時不得吸毒、飲酒或從事違法行為。甲方有監督權，乙方負管理考核責任；如有怠忽職守或違反規定，甲方得書面通知乙方依情節處理或調換。</p>`),
    article('九','保險事宜',`<p>甲方應依法投保建築物及公共設施相關保險；乙方依法辦理其員工之勞工保險、全民健康保險、勞工退休金及依法應辦之保險。</p>`),
    article('十','賠償責任金額及程序',`<p>乙方因故意或過失未盡契約義務，致甲方受有直接財物損害者，依可歸責程度負損害賠償責任。甲方應於事故發生或發現後 ${esc(d.claim_notice_hours)} 小時內通報，並於 ${esc(d.claim_document_days)} 日內提出證明文件、損失清單及相關帳冊。</p>`),
    article('十一','賠償責任上限',`<p>除乙方故意或重大過失外，每一事故之賠償責任以新臺幣 ${money(d.liability_cap)} 元為上限；但依法不得預先限制或免除者，不在此限。</p>`),
    article('十二','過失相抵',`<p>損害之發生或擴大如甲方、甲方人員、住戶、使用人或第三人亦有過失者，依其責任比例減輕乙方之賠償責任。</p>`),
    article('十三','不可抗力及除外責任',`<p>因天災、地變、颱風、洪水、戰爭、暴動、火災、氣爆或其他不可抗力所致損害；設備固有瑕疵、甲方指揮調派、未採納改善建議、設施未通過安全檢查、債務糾紛或非本契約約定服務所致之損害，非可歸責於乙方者，乙方不負責任。</p>`),
    article('十四','甲方終止契約',`<p>甲方得以書面通知乙方終止契約。一般契約於通知到達後 ${esc(d.termination_notice_days)} 日生效；契約期限一年以上者，於通知到達後 ${esc(d.long_term_notice_days)} 日生效。預告期間之服務費仍應支付。乙方違約經通知限期改正而未改正者，甲方得依法終止。</p>`),
    article('十五','乙方終止契約',`<p>因不可抗力致乙方無法繼續提供服務、甲方積欠費用經催告仍未繳付，或其他正當事由時，乙方得書面通知甲方終止。終止生效前之服務費及已發生費用，甲方仍應支付。</p>`),
    article('十六','服務費調整',`<p>基本工資、法定成本或物價重大變動，或勤務內容、人員配置變更時，服務費得經雙方書面同意調整。</p>`),
    article('十七','合意管轄',`<p>本契約所生爭議，雙方同意以 ${esc(d.jurisdiction||'臺灣桃園地方法院')} 為第一審管轄法院。</p>`),
    article('十八','誠信與補充',`<p>${esc(terms)}</p>`),
    article('十九','契約份數及生效',`<p>本契約書一式貳份，由甲乙雙方簽名或蓋章後生效，各執正本一份，以資信守。</p>`)
  ].join('');
  return`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(row.contract_no)} ${esc(typeName)}</title><style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;color:#111;font-size:12pt;line-height:1.75;margin:0;padding:15mm 17mm}.page{min-height:260mm;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}.cover{text-align:center;padding-top:12mm}.brand-group{font-size:19pt;font-weight:700}.brand-company{font-size:15pt;margin-top:5px}.cover h1{font-size:25pt;letter-spacing:6px;margin:24px 0 12px}.logo{width:46mm;height:46mm;object-fit:contain;margin:5px auto 18px}.cover-table{width:82%;margin:0 auto;border-collapse:collapse;text-align:left}.cover-table th,.cover-table td{border:1px solid #333;padding:8px}.cover-table th{width:28mm;text-align:center}.contact{margin-top:18px}.doc-title{text-align:center;font-size:18pt;margin:0 0 12px}.parties{margin:10px 0 18px;padding:10px;border-top:1px solid #333;border-bottom:1px solid #333}.parties p{margin:3px 0}.article{margin:0 0 14px;page-break-inside:avoid}.article h3{font-size:13pt;margin:0 0 5px}.article p{margin:3px 0;text-align:justify}.boxes{display:flex;flex-wrap:wrap;gap:8px 16px;margin:7px 0}.box{white-space:nowrap}.fees{width:100%;border-collapse:collapse;margin:10px 0}.fees th,.fees td{border:1px solid #333;padding:6px}.fees th{text-align:center;background:#f1f1f1}.fees td:nth-child(2),.fees td:nth-child(4),.fees td:nth-child(5){text-align:right}.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin-top:16px}.sign-box{min-height:88mm;border-top:1px solid #333;padding-top:8px}.sign-box p{margin:8px 0}.line-contact{width:150mm;margin:12mm auto 0;border:1px solid #a8b2bb;border-collapse:separate;border-spacing:6mm 4mm;page-break-inside:avoid}.line-contact td{vertical-align:middle}.line-contact .line-qr{width:38mm;text-align:center}.line-contact img{width:31mm;height:31mm;object-fit:contain}.line-contact h3{margin:0 0 4px;font-size:14pt}.line-contact p{margin:2px 0;font-size:10.5pt}.line-contact a{color:#111;text-decoration:none}.attachment{white-space:pre-wrap}.small{font-size:9pt;color:#555}.doc-actions{position:fixed;right:12px;top:12px;z-index:20;display:flex;gap:8px}.doc-actions button{padding:9px 13px}@media print{.doc-actions{display:none}.page{min-height:auto}} </style></head><body>
  <div class="page cover"><div class="brand-group">紘嘉物業集團</div><div class="brand-company">紘嘉保全股份有限公司</div><div class="brand-company">紘嘉公寓大廈管理維護股份有限公司</div><h1>${esc(typeName)}</h1><img class="logo" src="${logo}" alt="紘嘉圖標"><table class="cover-table"><tr><th>勞務名稱</th><td>${esc(row.project_name||'________________')}</td></tr><tr><th>執勤地點</th><td>${esc(row.client_name||'________________')}<br>${esc(row.site_address||'________________')}</td></tr><tr><th>合約編號</th><td>${esc(row.contract_no||'________________')}</td></tr><tr><th>承包廠商</th><td>${esc(company.name)}</td></tr></table><div class="contact">電話：${esc(company.phone)}<br>辦事處地址：${esc(company.address)}</div></div>
  <div class="page"><h1 class="doc-title">${esc(typeName)}</h1><div class="parties"><p>委託人：${esc(row.client_name||'________________')}（以下簡稱甲方）</p><p>受任人：${esc(company.name)}（以下簡稱乙方）</p><p>甲乙雙方同意依下列約定辦理：</p></div>${articles}</div>
  <div class="page"><h1 class="doc-title">立契約書者</h1><div class="sign-grid"><div class="sign-box"><b>甲方：${esc(row.client_name||'________________')}</b><p>代表人：${esc(row.client_representative||'________________')}</p><p>職稱：${esc(d.client_title||'________________')}</p><p>簽章：</p><p>地址：${esc(row.site_address||'________________')}</p><p>電話：${esc(d.client_phone||'________________')}</p><p>統一編號：${esc(d.client_tax_id||'________________')}</p></div><div class="sign-box"><b>乙方：${esc(company.name)}</b><p>負責人：${esc(d.company_representative||'________________')}</p><p>簽章：</p><p>地址：${esc(company.address)}</p><p>電話：${esc(company.phone)}</p><p>統一編號：${esc(company.taxId)}</p></div></div><p style="text-align:center;margin-top:18mm">${esc(rocDate(d.signing_date))}</p><table class="line-contact"><tr><td class="line-qr"><img src="${lineQr}" alt="紘嘉物業官方 LINE QR Code"></td><td><h3>紘嘉物業官方 LINE</h3><p>社區如有服務諮詢、勤務通知或其他事項，可掃描 QR Code 與我們聯繫。</p><p><a href="${lineOfficialUrl}">${lineOfficialUrl}</a></p></td></tr></table></div>
  <div class="page"><h1 class="doc-title">附件一　現場人力配置及服務內容</h1><table class="fees"><thead><tr><th>職務</th><th>人數</th><th>工作內容</th><th>每人月額</th><th>月小計</th></tr></thead><tbody>${staffRows||'<tr><td colspan="5">尚未填寫人力配置</td></tr>'}</tbody><tfoot><tr><th colspan="4">含稅每月服務費</th><th>${monthly}</th></tr></tfoot></table>${d.staffing_note?`<p><b>補充說明：</b>${esc(d.staffing_note)}</p>`:''}<div class="attachment">${esc(d.attachment_services||defaultAttachment())}</div><p class="small">本附件與報價單、勤務計畫及經雙方簽認之書面文件，均為本契約之一部分。</p></div>
  </body></html>`}
async function printContract(row,items){const old=$('#contractPrintFrame');if(old)old.remove();const frame=document.createElement('iframe');frame.id='contractPrintFrame';frame.title='正式合約預覽與列印';frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#fff;z-index:10000';document.body.appendChild(frame);frame.srcdoc=(await buildContractDocument(row,items)).replace('<body>',`<body><div class="doc-actions"><button onclick="parent.document.getElementById('contractPrintFrame').remove()">關閉預覽</button><button onclick="window.print()">列印／另存 PDF</button></div>`);}
async function downloadContract(row,items){const html=await buildContractDocument(row,items),blob=new Blob(['\ufeff'+html],{type:'application/msword;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a'),safe=String(`${row.contract_no}_${row.project_name||'勞務合約'}`).replace(/[\\/:*?"<>|]/g,'_');a.href=url;a.download=`${safe}.doc`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
async function remove(id){if(!confirm('確定刪除此份合約及其人力明細？刪除後無法復原。'))return;if(useCloud()){const{error}=await client.from('tender_contracts').delete().eq('id',id);if(error)return alert(error.message)}else saveDemo(demo().filter(x=>x.id!==id));await render()}
async function render(){const content=$('#content');content.innerHTML='<article class="panel empty">載入合約資料中…</article>';try{[rows,quotes]=await Promise.all([listContracts(),listQuotes()]);content.innerHTML=`<article class="panel"><div class="panel-head"><div><h3>正式勞務合約</h3><span class="muted">物業與保全合約，可連結報價、編輯、下載 Word 及列印</span></div><button class="btn primary" id="addTenderContract">＋ 新增正式合約</button></div><div class="contract-summary"><span>物業合約 <b>${rows.filter(x=>x.contract_type==='property').length}</b></span><span>保全合約 <b>${rows.filter(x=>x.contract_type==='security').length}</b></span><span>履約中 <b>${rows.filter(x=>x.status==='active').length}</b></span></div><div class="table-wrap"><table><thead><tr><th>合約編號</th><th>類型／承包廠商</th><th>委託單位／勞務名稱</th><th>報價單</th><th>期間</th><th>月費</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td><strong>${esc(x.contract_no)}</strong></td><td>${esc(types[x.contract_type])}<small>${esc(x.company_name)}</small></td><td>${esc(x.client_name)}<small>${esc(x.project_name)}</small></td><td>${esc(x.tender_quotations?.quote_no||'未連結')}</td><td>${esc(x.contract_start_date||'')}<small>至 ${esc(x.contract_end_date||'')}</small></td><td>$${money(x.monthly_total)}</td><td><span class="badge">${esc(statuses[x.status]||x.status)}</span></td><td><div class="action-row"><button class="mini-button" data-c-edit="${x.id}">編輯</button><button class="mini-button" data-c-print="${x.id}">預覽／列印</button><button class="mini-button" data-c-download="${x.id}">下載 Word</button><button class="mini-button danger" data-c-delete="${x.id}">刪除</button></div></td></tr>`).join(''):'<tr><td colspan="8" class="empty">尚無正式合約，可新增或從競標報價帶入。</td></tr>'}</tbody></table></div></article>`;$('#addTenderContract').onclick=()=>open();$$('[data-c-edit]').forEach(b=>b.onclick=()=>open(rows.find(x=>x.id===b.dataset.cEdit)));$$('[data-c-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.cDelete));$$('[data-c-print]').forEach(b=>b.onclick=async()=>{const row=rows.find(x=>x.id===b.dataset.cPrint);await printContract(row,await contractItems(row.id))});$$('[data-c-download]').forEach(b=>b.onclick=async()=>{const row=rows.find(x=>x.id===b.dataset.cDownload);await downloadContract(row,await contractItems(row.id))})}catch(error){content.innerHTML=`<article class="panel empty">載入失敗：${esc(error.message)}<br><small>若尚未建立正式合約欄位，請先執行 migration-formal-service-contract.sql。</small></article>`}}
window.TenderContracts={render,openFromQuotation:async id=>{quotes=await listQuotes();await open(null,id)}};
})();
