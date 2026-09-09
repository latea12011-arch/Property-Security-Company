import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('調離案場只結束目前指派並保留歷史班表',async()=>{
  const[html,app,worker]=await Promise.all([
    read('index.html'),
    read('assets/app.js'),
    read('admin-service-worker.js')
  ]);
  const sync=app.slice(app.indexOf('async function syncEmployeeSiteAssignments'),app.indexOf('async function saveRecord'));

  assert.match(sync,/update\(\{end_date:previousEnd\}\)/);
  assert.match(sync,/row\.start_date<current\.first/);
  assert.doesNotMatch(sync,/delete\(\)\.eq\('employee_id'/);
  assert.match(app,/staffIds=new Set\(\[\.\.\.assignments\.map\(x=>x\.employee_id\),\.\.\.scheduledIds\]\)/);
  assert.match(app,/取消勾選會結束目前指派，但過去月份的案場與班表紀錄會永久保留/);
  assert.match(html,/assets\/app\.js\?v=177/);
  assert.match(worker,/hongjia-admin-pwa-v121/);
});
