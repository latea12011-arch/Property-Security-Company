(()=>{
  'use strict';
  const original=window.renderCommitteeManagement;
  if(typeof original!=='function')return;

  window.renderCommitteeManagement=async function(...args){
    await original(...args);
    document.querySelectorAll('[data-toggle]').forEach(toggle=>{
      const cell=toggle.closest('td');
      if(!cell||cell.querySelector('[data-delete-committee]'))return;
      const row=toggle.closest('tr');
      const cells=row?.querySelectorAll('td');
      const site=cells?.[0]?.querySelector('strong')?.textContent?.trim()||'未命名社區';
      const member=cells?.[1]?.childNodes?.[0]?.textContent?.trim()||'未命名委員';
      const email=cells?.[2]?.textContent?.trim()||'';
      const button=document.createElement('button');
      button.type='button';
      button.className='mini-button danger';
      button.dataset.deleteCommittee=toggle.dataset.toggle;
      button.textContent='永久刪除';
      button.onclick=async()=>{
        if(!await window.ERP_CONFIRM(`確定永久刪除「${site}」的管委會帳號？\n\n委員：${member}\nEmail：${email}\n\n系統會清除這個 Email 的所有管委會授權；刪除後無法進入管委會 APP。`,'永久刪除管委會帳號'))return;
        button.disabled=true;
        try{
          const client=window.ERP_CLIENT;
          const matchingIds=[...document.querySelectorAll('[data-delete-committee]')].filter(candidate=>{
            const candidateRow=candidate.closest('tr'),candidateEmail=candidateRow?.querySelectorAll('td')?.[2]?.textContent?.trim().toLowerCase();
            return candidateEmail===email.toLowerCase();
          }).map(candidate=>candidate.dataset.deleteCommittee);
          const ids=[...new Set(matchingIds.length?matchingIds:[button.dataset.deleteCommittee])];
          let deletedAuthUser=false;
          for(const id of ids){
            const{data,error}=await client.functions.invoke('quick-worker',{body:{action:'delete_committee_permanently',access_id:id,confirmation_email:email}});
            if(error)throw error;
            if(!data?.ok)throw new Error(data?.error||'刪除失敗');
            deletedAuthUser=deletedAuthUser||Boolean(data.deleted_auth_user);
          }
          const count=ids.length;
          await window.ERP_ALERT(deletedAuthUser
            ?`已永久刪除管委會登入帳號、登入工作階段及 ${count} 筆社區授權，重新整理後也無法再登入。`
            :`已永久清除這個 Email 的 ${count} 筆管委會授權與相關資料，已無法進入管委會 APP。\n\n因同一 Email 也是 ERP 管理員或員工，僅保留 ERP 登入帳號，避免 ERP 帳號一併被刪除。`,'刪除完成');
          await window.renderCommitteeManagement();
        }catch(error){
          await window.ERP_ALERT(`刪除失敗：${error.message}`,'刪除失敗');
          button.disabled=false;
        }
      };
      cell.append(' ',button);
    });
  };
})();
