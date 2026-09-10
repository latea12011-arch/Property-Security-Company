import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const root=new URL('../',import.meta.url),app=readFileSync(new URL('assets/app.js',root),'utf8');
const source=app.slice(app.indexOf('  function printCashReceipt('),app.indexOf('  function cashReceiptRecord('));
const row={id:'r1',employee_id:'e1',site_id:'s1',work_date:'2026-09-01',start_time:'07:00',end_time:'19:00',cash_amount:2500};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function render(employee){
  let printed;
  const context={state:{cashReceiptMonth:'2026-09',relations:{employees:[employee],sites:[{id:'s1',name:'A 社區'}]}},bankMaster:{find:code=>code==='004'?{code:'004',name:'臺灣銀行'}:null},esc,showNotice(){},printDocument:(title,body)=>{printed={title,body}}};
  vm.runInNewContext(`${source};printCashReceipt(${JSON.stringify([row])})`,context);
  return printed;
}

test('薪資領取申請單自動帶入身分證末四碼與銀行資料',()=>{
  const printed=render({id:'e1',employee_no:'A001',full_name:'王小明',national_id:'A123456789',salary_payment_method:'bank_transfer',bank_code:'004',bank_account_no:'0123456789'});
  assert.equal(printed.title,'薪資領取申請單');
  assert.match(printed.body,/身分證末四碼：<strong>6789<\/strong>/);
  assert.match(printed.body,/☑ 銀行匯款/);
  assert.match(printed.body,/004 臺灣銀行/);
  assert.match(printed.body,/0123456789/);
});

test('領現不顯示銀行帳戶，銀行資料缺漏時保留手寫空格',()=>{
  const cash=render({id:'e1',salary_payment_method:'cash'}).body;
  assert.match(cash,/☑ 領現/);
  assert.doesNotMatch(cash,/銀行帳號：/);

  const missing=render({id:'e1',salary_payment_method:'bank_transfer'}).body;
  assert.match(missing,/匯款銀行：<\/strong>_{10,}/);
  assert.match(missing,/銀行帳號：<\/strong>_{10,}/);
  assert.match(missing,/身分證末四碼：_{10,}/);
});
