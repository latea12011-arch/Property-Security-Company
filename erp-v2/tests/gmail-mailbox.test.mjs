import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');

test('ERP 公司郵件中心可讀取 Gmail 並在原討論串回覆',()=>{
  const html=read('index.html'),app=read('assets/app.js'),mailbox=read('assets/gmail-mailbox.js'),edge=read('../supabase/functions/gmail-mailbox/index.ts');
  assert.match(html,/data-view="gmailMailbox">公司郵件中心/);
  assert.match(html,/assets\/gmail-mailbox\.js\?v=1/);
  assert.match(app,/gmailMailbox:\['公司郵件中心'/);
  assert.match(app,/window\.GmailMailbox\.render/);
  assert.match(mailbox,/hongjia_prse@gmail\.com/);
  for(const action of ["list","get","reply"])assert.match(mailbox,new RegExp(`call\\('${action}'`));
  assert.match(mailbox,/回覆已成功寄出/);
  assert.match(edge,/GMAIL_REFRESH_TOKEN/);
  assert.match(edge,/gmail\/v1\/users\/me/);
  assert.match(edge,/removeLabelIds:\['UNREAD'\]/);
  assert.match(edge,/threadId,raw:encodeBase64Url/);
  assert.match(edge,/只有系統管理員可以查看公司郵件/);
});
