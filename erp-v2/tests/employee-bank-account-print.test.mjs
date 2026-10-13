import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const[app,batch]=await Promise.all([
  readFile(new URL('../assets/app.js',import.meta.url),'utf8'),
  readFile(new URL('../assets/employee-batch-actions.js',import.meta.url),'utf8'),
]);

test('員工管理可單獨列印銀行帳戶資訊',()=>{
  assert.match(app,/function printEmployeeBankAccount\(row\)/);
  assert.match(app,/data-print-bank=/);
  assert.match(app,/列印銀行帳戶/);
  assert.match(app,/員工銀行帳戶資訊/);
  assert.match(app,/薪資發放方式/);
  assert.match(app,/本表僅供公司薪資發放與銀行帳戶資料核對使用/);
  assert.match(app,/\$\$\('\[data-print-bank\]'\)/);
});

test('員工可勾選多人列印銀行帳戶清冊',()=>{
  assert.match(batch,/data-employee-select=/);
  assert.match(batch,/data-employee-select-all/);
  assert.match(batch,/data-employee-bank-print/);
  assert.match(batch,/列印勾選銀行帳戶/);
  assert.match(batch,/員工銀行帳戶清冊/);
  for(const label of ['員工編號','員工姓名','職稱','發放方式','銀行','分行','銀行帳號'])assert.match(batch,new RegExp(label));
  assert.match(app,/bankLabel:code=>employeeOptionText\('bank_code',code\)/);
});

test('銀行帳戶列印不包含員工敏感基本資料',()=>{
  const section=app.match(/function printEmployeeBankAccount\(row\)\{[\s\S]*?\n  \}/)?.[0]||'';
  assert.doesNotMatch(section,/national_id|身分證|phone|電話|address|地址/);
  assert.match(section,/bank_code/);
  assert.match(section,/bank_branch/);
  assert.match(section,/bank_account_no/);
});
