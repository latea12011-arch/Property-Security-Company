(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const categoryLabels={general:'一般行政',administration:'行政文書',finance:'財務作業',repair:'修繕設備',vendor:'廠商聯繫',resident:'住戶服務',meeting:'會議事項',incident:'異常事件',other:'其他'};
  const statusLabels={pending:'待處理',processing:'處理中',completed:'已完成'};
  let selectedSite='',selectedMonth=new Date().toISOString().slice(0,7),selectedStatus='';

  async function signedPhoto(client,path){
    if(!path)return'';
    const{data}=await client.storage.from('community-work-log-media').createSignedUrl(path,900);
    return data?.signedUrl||'';
  }

  window.renderWorkLogReview=async function(){
    const client=window.ERP_CLIENT,host=$('#content');
    if(!client)throw Error('尚未連接雲端資料庫');
    $('#pageTitle').textContent='工作日誌審閱';
    const first=`${selectedMonth}-01`,endDate=new Date(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0),last=endDate.toISOString().slice(0,10);
    const{data:sites,error:siteError}=await client.from('sites').select('id,code,name').eq('status','active').order('name');
    if(siteError)throw siteError;
    let query=client.from('community_work_logs').select('*,sites(name,code),employees(employee_no,full_name,job_title)').gte('log_date',first).lte('log_date',last).order('log_date',{ascending:false}).order('created_at',{ascending:false});
    if(selectedSite)query=query.eq('site_id',selectedSite);
    if(selectedStatus)query=query.eq('follow_up_status',selectedStatus);
    const{data,error}=await query;
    if(error)throw error;
    const rows=data||[];
    await Promise.all(rows.map(async row=>{row.photo_url=await signedPhoto(client,row.attachment_path)}));
    host.innerHTML=`<article class="panel work-log-review"><div class="panel-head"><div><h3>社區工作日誌</h3><span class="muted">公司主管可依社區、月份及處理狀態查閱</span></div><span class="badge">${rows.length} 筆</span></div><div class="record-search work-log-filters"><label>社區<select id="workLogSite"><option value="">全部社區</option>${(sites||[]).map(site=>`<option value="${site.id}" ${selectedSite===site.id?'selected':''}>${esc(site.code)}－${esc(site.name)}</option>`).join('')}</select></label><label>月份<input id="workLogMonth" type="month" value="${selectedMonth}"></label><label>狀態<select id="workLogStatus"><option value="">全部狀態</option>${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${selectedStatus===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="work-log-review-list">${rows.length?rows.map(row=>`<article class="quick-item work-log-review-item"><div class="work-log-review-copy"><strong>${esc(row.log_date)}・${esc(row.title)}</strong><small>${esc(row.sites?.name||'未指定社區')}｜${esc(row.employees?.employee_no||'')} ${esc(row.employees?.full_name||'')}｜${esc(categoryLabels[row.category]||row.category)}</small><p>${esc(row.content)}</p>${row.photo_url?`<a href="${esc(row.photo_url)}" target="_blank" rel="noopener"><img src="${esc(row.photo_url)}" alt="${esc(row.title)}的工作照片" style="width:180px;max-width:100%;border-radius:10px;margin-top:8px"></a>`:''}</div><div class="action-row"><label>處理狀態<select data-log-status="${row.id}">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${row.follow_up_status===value?'selected':''}>${label}</option>`).join('')}</select></label><label><input type="checkbox" data-log-visible="${row.id}" ${row.visible_to_committee?'checked':''}> 管委會可見</label></div></article>`).join(''):'<div class="empty">此查詢條件目前沒有工作日誌。</div>'}</div></article>`;
    $('#workLogSite').onchange=event=>{selectedSite=event.target.value;window.renderWorkLogReview()};
    $('#workLogMonth').onchange=event=>{selectedMonth=event.target.value||new Date().toISOString().slice(0,7);window.renderWorkLogReview()};
    $('#workLogStatus').onchange=event=>{selectedStatus=event.target.value;window.renderWorkLogReview()};
    document.querySelectorAll('[data-log-status]').forEach(select=>select.onchange=async()=>{const{error:updateError}=await client.from('community_work_logs').update({follow_up_status:select.value}).eq('id',select.dataset.logStatus);if(updateError){alert(`狀態更新失敗：${updateError.message}`);window.renderWorkLogReview()}else window.ERP_SHOW_NOTICE?.('工作日誌狀態已更新。','success')});
    document.querySelectorAll('[data-log-visible]').forEach(input=>input.onchange=async()=>{const{error:updateError}=await client.from('community_work_logs').update({visible_to_committee:input.checked}).eq('id',input.dataset.logVisible);if(updateError){input.checked=!input.checked;alert(`可見範圍更新失敗：${updateError.message}`)}else window.ERP_SHOW_NOTICE?.('管委會可見設定已更新。','success')});
  };
})();
