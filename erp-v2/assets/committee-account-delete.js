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
        if(!confirm(`確定永久刪除「${site}」的管委會帳號？\n\n委員：${member}\nEmail：${email}\n\n刪除後將無法登入或查看該社區；此操作無法復原。`))return;
        button.disabled=true;
        try{
          const client=window.ERP_CLIENT,id=button.dataset.deleteCommittee;
          const{data,error}=await client.functions.invoke('quick-worker',{body:{action:'delete_committee_permanently',access_id:id,confirmation_email:email}});
          if(error)throw error;
          if(!data?.ok)throw new Error(data?.error||'刪除失敗');
          alert(data.deleted_auth_user?'管委會授權、相關資料、登入帳號及登入工作階段已永久刪除。':'管委會授權與相關資料已永久刪除；此 Email 同時屬於 ERP 管理員或員工，因此保留 ERP 登入帳號。');
          await window.renderCommitteeManagement();
        }catch(error){
          alert(`刪除失敗：${error.message}`);
          button.disabled=false;
        }
      };
      cell.append(' ',button);
    });
  };
})();
