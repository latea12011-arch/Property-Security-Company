import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('員工管理可儲存薪資銀行分行且薪資明細會自動帶入',async()=>{
  const[app,migration,employeeSql,payrollSql]=await Promise.all([
    read('assets/app.js'),
    read('database/migration-employee-bank-branch.sql'),
    read('database/migration-employee-payment-details.sql'),
    read('database/migration-payroll-transfer-fees.sql'),
  ]);
  assert.match(app,/\['bank_branch','銀行分行','text'\]/);
  assert.match(app,/\['bank_branch','匯款分行','text'\]/);
  assert.match(app,/name="bank_branch"/);
  assert.match(app,/select\('salary_payment_method,bank_code,bank_branch,bank_account_no,bank_fee_mode'\)/);
  assert.match(app,/bank_branch:employee\.bank_branch\|\|''/);
  assert.match(app,/銀行、分行與帳戶皆可留空/);
  assert.match(app,/row\.bank_branch/);
  assert.match(app,/employee\?\.bank_branch/);
  assert.match(migration,/alter table public\.employees[\s\S]*bank_branch text/);
  assert.match(migration,/alter table public\.payroll_records[\s\S]*bank_branch text/);
  assert.match(employeeSql,/bank_branch text/);
  assert.match(payrollSql,/bank_branch text/);
});
