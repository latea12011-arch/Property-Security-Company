import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const moduleCode=fs.readFileSync(new URL('../assets/annual-leave-cashouts.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../database/migration-annual-leave-cashouts.sql',import.meta.url),'utf8');
const deleteMigration=fs.readFileSync(new URL('../database/migration-annual-leave-cashouts-delete.sql',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../admin-service-worker.js',import.meta.url),'utf8');

test('特休換薪位於薪資與行政並使用獨立權限',()=>{
  assert.match(html,/data-view="annualLeaveCashouts">特休換薪申請單/);
  assert.match(html,/assets\/annual-leave-cashouts\.js\?v=3/);
  assert.match(app,/\['annualLeaveCashouts','特休換薪申請單'\]/);
  assert.match(app,/annualLeaveCashouts:\['休','薪資行政'\]/);
  assert.match(app,/state\.view==='annualLeaveCashouts'\?await window\.AnnualLeaveCashouts\.render\(\)/);
  assert.match(migration,/has_feature_permission\('annualLeaveCashouts'\)/);
  assert.doesNotMatch(app,/annualLeaveCashouts'&&state\.user\?\.permissions\?\.includes\('payroll'/);
});

test('滿一年才可換薪且每個到職週年重新計算',()=>{
  assert.match(migration,/hire_date \+ interval '1 year' > new\.application_date/);
  assert.match(migration,/make_interval\(years=>completed_years\)/);
  assert.match(migration,/make_interval\(years=>completed_years\+1\)/);
  assert.match(migration,/status in \('approved','paid'\)/);
  assert.match(migration,/approved_leave_hours \+ approved_cashout_hours/);
  assert.match(migration,/refresh_employee_annual_leave\(employee_to_refresh,current_date\)/);
});

test('保全採十小時，其餘指定職務與內部人員採八小時',()=>{
  assert.match(migration,/employee_type,''\)='internal' then 8/);
  assert.match(migration,/in \('總幹事','社區秘書','秘書'\) then 8/);
  assert.match(migration,/like '%保全%' then 10/);
  assert.match(migration,/basic_salary\/30\.0\/new\.daily_hours_basis/);
  assert.match(migration,/new\.calculated_amount := round\(new\.requested_hours\*new\.hourly_rate\)/);
  assert.match(moduleCode,/換薪金額＝月薪 ÷ 30 ÷ 每日計算時數 × 申請換薪時數/);
});

test('申請單可預覽、審核、列印並阻擋超額申請',()=>{
  for(const value of ['pending','approved','rejected','paid','cancelled'])assert.match(moduleCode,new RegExp(`${value}:`));
  assert.match(moduleCode,/requested>available/);
  assert.match(moduleCode,/申請時數不可超過目前可換薪餘額/);
  assert.match(moduleCode,/特休換薪申請單/);
  assert.match(moduleCode,/申請人簽名/);
  assert.match(moduleCode,/行政覆核/);
  assert.match(moduleCode,/button\.onclick=\(\)=>printRow/);
  assert.match(moduleCode,/annualCashoutPrintFrame/);
  assert.match(moduleCode,/frame\.contentWindow\.print\(\)/);
  assert.doesNotMatch(moduleCode,/forEach\(button=>printRow/);
  assert.doesNotMatch(moduleCode,/window\.open\(/);
  assert.match(css,/\.annual-cashout-preview/);
});

test('申請單提供二次確認刪除並由資料庫重新計算餘額',()=>{
  assert.match(moduleCode,/data-cashout-delete/);
  assert.match(moduleCode,/ERP_CONFIRM/);
  assert.match(moduleCode,/from\('annual_leave_cashouts'\)\.delete\(\)\.eq\('id',row\.id\)/);
  assert.match(moduleCode,/特休餘額會自動重新計算/);
  assert.match(deleteMigration,/grant delete on public\.annual_leave_cashouts to authenticated/);
  assert.match(migration,/sync_annual_leave_after_cashout after insert or update or delete/);
});

test('離線快取與正式資產版本已更新',()=>{
  assert.match(worker,/hongjia-admin-pwa-v132/);
  assert.match(worker,/annual-leave-cashouts\.js/);
  assert.match(html,/assets\/app\.css\?v=93/);
  assert.match(html,/assets\/app\.js\?v=185/);
});
