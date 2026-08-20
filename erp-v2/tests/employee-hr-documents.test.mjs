import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('員工資料支援出生日期、84-1 審核、批次列印及任職文件',async()=>{
  const[html,app,batch,documents,migration,worker]=await Promise.all([
    read('index.html'),read('assets/app.js'),read('assets/employee-batch-actions.js'),
    read('assets/employee-documents.js'),read('database/migration-employee-birth-84-1-and-advance-form.sql'),
    read('service-worker.js'),
  ]);
  assert.match(html,/pdf-lib@1\.17\.1/);
  assert.match(html,/employee-batch-actions\.js\?v=2/);
  assert.match(app,/\['birth_date','出生年月日','date'\]/);
  assert.match(app,/\['labor_84_1_status','84-1 核備狀態'/);
  assert.match(app,/\['labor_84_1_approval_no','核備文號'/);
  assert.match(batch,/列印勾選/);
  assert.doesNotMatch(batch,/employee-batch-download/);
  for(const field of ['員工姓名','出生年月日','身分證字號','職稱','到職日期','緊急聯絡人','緊急聯絡人電話','警局核備','84-1 核備'])assert.match(batch,new RegExp(field));
  assert.doesNotMatch(batch,/基本薪資/);
  assert.match(documents,/全選/);
  assert.match(documents,/下載勾選 PDF/);
  assert.match(documents,/列印勾選 PDF/);
  assert.match(documents,/labor-standards-act-84-1-agreement\.pdf/);
  assert.match(migration,/add column if not exists birth_date date/);
  assert.match(migration,/labor_84_1_status/);
  assert.match(worker,/employee-documents\/labor-standards-act-84-1-agreement\.pdf/);
});

test('借支資料補齊核准、撥款、償還方式並產生正式申請單',async()=>{
  const[app,migration]=await Promise.all([
    read('assets/app.js'),read('database/migration-employee-birth-84-1-and-advance-form.sql'),
  ]);
  assert.match(app,/\['approved_amount','核准金額','number'\]/);
  assert.match(app,/\['disbursement_method','撥款方式','select'/);
  assert.match(app,/\['repayment_method','扣回方式','select'/);
  assert.match(app,/員工借支申請單/);
  assert.match(app,/申請人簽名/);
  assert.match(app,/總管理處/);
  assert.match(migration,/approved_amount/);
  assert.match(migration,/repayment_method/);
});
