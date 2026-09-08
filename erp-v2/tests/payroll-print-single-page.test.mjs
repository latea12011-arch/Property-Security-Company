import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('薪資明細使用單頁緊湊列印版且保留簽章欄',async()=>{
  const[html,app,worker]=await Promise.all([
    read('index.html'),
    read('assets/app.js'),
    read('admin-service-worker.js')
  ]);

  assert.match(html,/assets\/app\.js\?v=176/);
  assert.match(app,/title\.includes\('薪資明細'\)/);
  assert.match(app,/class="\$\{payrollPrint\?'payroll-print':''\}"/);
  assert.match(app,/\.payroll-print\{padding:9mm 15mm;font-size:11\.5px\}/);
  assert.match(app,/\.payroll-print th,\.payroll-print td\{padding:4px 7px/);
  assert.match(app,/\.payroll-print \.sign\{margin-top:16px/);
  assert.match(app,/公司用印：/);
  assert.match(app,/行政覆核：/);
  assert.match(worker,/hongjia-admin-pwa-v120/);
});
