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
          const itemResult=await client.from('community_committee_items').delete().eq('access_id',id);
          if(itemResult.error&&!/does not exist|schema cache/i.test(itemResult.error.message))throw itemResult.error;
          const{error}=await client.from('community_committee_access').delete().eq('id',id);
          if(error)throw error;
          alert('管委會帳號與社區授權已永久刪除。');
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
