import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appPath=new URL('../assets/app.js',import.meta.url);
const cssPath=new URL('../assets/app.css',import.meta.url);
const indexPath=new URL('../index.html',import.meta.url);
const workerPath=new URL('../admin-service-worker.js',import.meta.url);
const app=fs.readFileSync(appPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');
const index=fs.readFileSync(indexPath,'utf8');
const worker=fs.readFileSync(workerPath,'utf8');

test('groups receipt rows by employee and sorts each employee by date',()=>{
  const start=app.indexOf('function groupCashReceiptRows');
  const end=app.indexOf('function cashReceiptBatchPage',start);
  assert.ok(start>=0&&end>start);
  const context={};
  vm.runInNewContext(`${app.slice(start,end)};this.groupCashReceiptRows=groupCashReceiptRows`,context);
  const groups=context.groupCashReceiptRows([
    {employee_id:'e1',work_date:'2026-09-20'},
    {employee_id:'e2',work_date:'2026-09-10'},
    {employee_id:'e1',work_date:'2026-09-05'}
  ]);
  assert.equal(groups.length,2);
  assert.deepEqual(Array.from(groups[0],row=>row.work_date),['2026-09-05','2026-09-20']);
});

test('renders monthly receipt statistics and all-print workflow',()=>{
  assert.match(app,/function printAllCashReceipts\(rows\)/);
  assert.match(app,/button\.textContent='全部列印'/);
  assert.match(app,/本月領取統計：<\/strong>共 \$\{rows\.length\} 次/);
  assert.match(app,/本月總金額/);
  assert.match(app,/同一位員工依日期彙整次數、金額與總額/);
  assert.match(app,/groups\.map\(cashReceiptBatchPage\)/);
  assert.match(app,/<details class="cash-receipt-summary">/);
  assert.match(app,/展開查看/);
  assert.match(app,/收起統計/);
  assert.match(css,/\.cash-receipt-summary/);
});

test('bumps ERP assets and service-worker cache',()=>{
  assert.match(index,/assets\/app\.css\?v=91/);
  assert.match(index,/assets\/app\.js\?v=183/);
  assert.match(worker,/hongjia-admin-pwa-v127/);
});
