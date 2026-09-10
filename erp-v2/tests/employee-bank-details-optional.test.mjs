import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('員工選擇銀行匯款時銀行與帳號仍可稍後補填',async()=>{
  const[app,html,worker]=await Promise.all([read('assets/app.js'),read('index.html'),read('admin-service-worker.js')]);
  assert.doesNotMatch(app,/table==='employees'.{0,120}!record\.bank_code\|\|!record\.bank_account_no/);
  assert.doesNotMatch(app,/薪資選擇銀行匯款時，請選擇銀行並填寫銀行帳戶/);
  assert.match(app,/table==='payroll_records'.{0,160}!record\.bank_code\|\|!record\.bank_account_no/);
  assert.match(html,/assets\/app\.js\?v=179/);
  assert.match(worker,/hongjia-admin-pwa-v123/);
});
