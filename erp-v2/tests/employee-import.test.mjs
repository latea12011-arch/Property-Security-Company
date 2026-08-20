import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('員工管理提供範本下載、Excel CSV 預覽與批次新增更新', async () => {
  const [html, app, importer, css, worker, adminWorker, template] = await Promise.all([
    read('index.html'),
    read('assets/app.js'),
    read('assets/employee-import.js'),
    read('assets/app.css'),
    read('service-worker.js'),
    read('admin-service-worker.js'),
    readFile(new URL('../assets/templates/employee-import-template.xlsx', import.meta.url)),
  ]);
  assert.match(html, /assets\/employee-import\.js\?v=2/);
  assert.match(html, /assets\/app\.js\?v=122/);
  assert.match(app, /EmployeeImport\.configure/);
  assert.match(app, /EmployeeImport\.attach/);
  assert.match(importer, /下載員工匯入範本/);
  assert.match(importer, /上傳員工資料/);
  assert.match(importer, /\.xlsx,\.xls,\.csv/);
  assert.match(importer, /XLSX\.read/);
  assert.match(importer, /員工資料批次匯入/);
  assert.match(importer, /略過重複工號，只新增新員工/);
  assert.match(importer, /依工號更新既有員工/);
  assert.match(importer, /初始密碼至少 8 碼/);
  assert.match(importer, /employee_payroll_profiles/);
  assert.match(importer, /site_assignments/);
  assert.match(importer, /quick-worker/);
  assert.match(importer, /下載結果 CSV/);
  assert.match(importer, /providedEmployeeFields/);
  assert.match(css, /\.employee-import-dialog/);
  assert.match(worker, /hongjia-erp-v2-135/);
  assert.match(worker, /assets\/employee-import\.js/);
  assert.match(worker, /employee-import-template\.xlsx/);
  assert.match(adminWorker, /hongjia-admin-pwa-v58/);
  assert.ok(template.byteLength > 10_000);
  assert.equal(template.subarray(0, 2).toString(), 'PK');
});
