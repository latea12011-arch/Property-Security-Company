import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('警局核備與員工管理共用一對一資料並有獨立清冊',async()=>{
  const[html,app,module,sql,worker,adminWorker]=await Promise.all([
    read('index.html'),
    read('assets/app.js'),
    read('assets/police-approvals.js'),
    read('database/migration-employee-police-approvals.sql'),
    read('service-worker.js'),
    read('admin-service-worker.js')
  ]);
  assert.match(html,/data-view="policeApprovals"/);
  assert.match(html,/police-approvals\.js\?v=2/);
  assert.match(html,/assets\/app\.js\?v=90/);
  assert.match(app,/\['policeApprovals','警局核備'\]/);
  assert.match(app,/police_approval_status/);
  assert.match(app,/employee_police_approvals'\)\.upsert/);
  assert.match(app,/onConflict:'employee_id'/);
  assert.match(module,/列印勾選資料/);
  assert.match(module,/單獨列印/);
  assert.match(module,/未送件/);
  assert.match(module,/補件中/);
  assert.match(module,/核備通過/);
  assert.match(module,/鴻嘉\(核\)字號/);
  assert.match(module,/data-police-select/);
  assert.match(module,/data-police-print-one/);
  assert.match(module,/printSelectedRows/);
  assert.match(sql,/employee_id uuid not null unique/);
  assert.match(sql,/has_feature_permission\('policeApprovals'\)/);
  assert.match(worker,/hongjia-erp-v2-90/);
  assert.match(adminWorker,/hongjia-admin-pwa-v11/);
});
