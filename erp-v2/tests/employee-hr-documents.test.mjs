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
  assert.match(html,/assets\/lazy-libs\.js\?v=1/);
  assert.match(html,/employee-batch-actions\.js\?v=7/);
  assert.match(app,/\['birth_date','出生年月日','date'\]/);
  assert.match(app,/\['labor_84_1_status','84-1 核備狀態'/);
  assert.match(app,/\['labor_84_1_approval_no','84-1 核備字號'/);
  assert.match(batch,/列印勾選/);
  assert.doesNotMatch(batch,/employee-batch-download/);
  for(const field of ['員工姓名','出生年月日','身分證字號','職稱','到職日期','緊急聯絡人','緊急聯絡人電話','警局核備','84-1 核備'])assert.match(batch,new RegExp(field));
  assert.doesNotMatch(batch,/基本薪資/);
  assert.match(batch,/桃警刑字第/);
  assert.match(batch,/labor_84_1_approval_no/);
  assert.match(batch,/@page\{size:A4 landscape/);
  assert.match(batch,/員工基本資料清冊/);
  assert.match(batch,/rows\.map\(row=>/);
  assert.match(html,/data-view="labor841Approvals">84-1 核備/);
  assert.match(html,/labor-84-1-approvals\.js\?v=5/);
  const labor841=await read('assets/labor-84-1-approvals.js');
  for(const text of ['列印勾選','下載勾選','data-labor841-print','data-labor841-download','84-1 核備字號','公司發文字號'])assert.match(labor841,new RegExp(text));
  assert.match(labor841,/application\/msword/);
  assert.match(labor841,/@page\{size:A4 landscape/);
  for(const field of ['出生年月日','身分證字號','最高學歷'])assert.match(labor841,new RegExp(field));
  for(const prefix of ['紘勞字第','府勞條字第'])assert.match(labor841,new RegExp(prefix));
  assert.match(labor841,/inputmode="numeric" pattern="\[0-9\]\*"/);
  assert.match(labor841,/values\.labor_84_1_document_no=digits/);
  assert.match(labor841,/values\.labor_84_1_approval_no=digits/);
  assert.match(app,/\['highest_education','最高學歷','text'\]/);
  assert.match(documents,/全選/);
  assert.match(documents,/下載勾選 PDF/);
  assert.match(documents,/列印勾選 PDF/);
  assert.match(documents,/labor-standards-act-84-1-agreement\.pdf/);
  assert.match(migration,/add column if not exists birth_date date/);
  assert.match(migration,/labor_84_1_status/);
  assert.doesNotMatch(worker,/employee-documents\/labor-standards-act-84-1-agreement\.pdf/);
});

test('請假審核可列印精簡 A5 請假單',async()=>{
  const app=await read('assets/app.js');
  assert.match(app,/function printLeaveRequest/);
  assert.match(app,/@page\{size:A5 portrait/);
  assert.match(app,/請假申請單/);
  assert.match(app,/frame\.contentWindow\.print\(\)/);
  assert.doesNotMatch(app,/printLeaveRequest[\s\S]{0,500}window\.open/);
  assert.match(app,/table==='leave_requests'\?printLeaveRequest/);
  assert.match(app,/\['employees','leave_requests','payroll_records'/);
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
