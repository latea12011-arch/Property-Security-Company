(()=>{
  'use strict';
  let active=null;
  function close(value){if(!active)return;const{dialog,resolve}=active;active=null;dialog.close();dialog.remove();resolve(value)}
  function open({title='系統訊息',message='',input=false,value='',confirmText='確定',cancelText=''}){
    if(active)close(null);
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.className='erp-message-dialog';
      dialog.innerHTML=`<form method="dialog"><div class="erp-message-brand">紘嘉物業 ERP</div><h3></h3><p></p>${input?'<input class="erp-message-input" autocomplete="off">':''}<div class="erp-message-actions">${cancelText?'<button type="button" class="btn ghost" data-cancel></button>':''}<button type="submit" class="btn primary" data-confirm></button></div></form>`;
      dialog.querySelector('h3').textContent=title;
      dialog.querySelector('p').textContent=String(message);
      const confirm=dialog.querySelector('[data-confirm]');confirm.textContent=confirmText;
      const cancel=dialog.querySelector('[data-cancel]');if(cancel){cancel.textContent=cancelText;cancel.onclick=()=>close(null)}
      const field=dialog.querySelector('input');if(field)field.value=String(value??'');
      dialog.querySelector('form').onsubmit=event=>{event.preventDefault();close(field?field.value:true)};
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(null)});
      document.body.appendChild(dialog);active={dialog,resolve};dialog.showModal();if(field)field.focus();else confirm.focus();
    });
  }
  window.ERP_ALERT=(message,title='系統訊息')=>open({title,message});
  window.ERP_CONFIRM=(message,title='請確認')=>open({title,message,confirmText:'確定',cancelText:'取消'}).then(Boolean);
  window.ERP_PROMPT=(message,value='',title='請輸入')=>open({title,message,input:true,value,confirmText:'確定',cancelText:'取消'});
  // 舊模組的訊息也改由 ERP 自訂視窗呈現，避免瀏覽器顯示 GitHub Pages 網址。
  window.alert=(message)=>{void window.ERP_ALERT(message);};
})();
