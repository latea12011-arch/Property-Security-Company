import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../assets/bank-master.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(source,context,{filename:'bank-master.js'});
const banks=context.window.BankMaster;

assert.ok(banks,'應建立共用 BankMaster');
assert.equal(banks.find('004').name,'臺灣銀行');
assert.equal(banks.resolve('4').code,'004');
assert.equal(banks.resolve('824').name,'連線商業銀行 LINE Bank');
assert.equal(banks.resolve('LINE').code,'824');
assert.equal(banks.resolve('郵局').code,'700');
assert.equal(banks.resolve('中信').code,'822');
assert.equal(banks.resolve('中國信託商業銀行').code,'822');
assert.equal(typeof banks.find('004').code,'string');
assert.ok(banks.all.length>=61,`銀行主檔筆數不足：${banks.all.length}`);

const [erpHtml,mobileHtml,employeeSql,payrollSql]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../mobile.html',import.meta.url),'utf8'),
  readFile(new URL('../database/migration-employee-payment-details.sql',import.meta.url),'utf8'),
  readFile(new URL('../database/migration-payroll-transfer-fees.sql',import.meta.url),'utf8')
]);
assert.match(erpHtml,/assets\/bank-master\.js/);
assert.match(mobileHtml,/assets\/bank-master\.js/);
for(const sql of [employeeSql,payrollSql]){
  assert.match(sql,/bank_code text/);
  assert.match(sql,/bank_account_no text/);
  assert.doesNotMatch(sql,/bank_(?:code|account_no)\s+(?:integer|numeric|bigint)/i);
}

console.log(`bank master tests passed (${banks.all.length} entries)`);
