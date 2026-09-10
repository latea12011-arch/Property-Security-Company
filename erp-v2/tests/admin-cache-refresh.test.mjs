import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('ERP 更新後立即載入最新程式且員工銀行資料標示為選填',async()=>{
  const[app,html,worker]=await Promise.all([read('assets/app.js'),read('index.html'),read('admin-service-worker.js')]);
  assert.match(app,/銀行與帳戶皆可留空，員工資料仍可先儲存/);
  assert.match(app,/serviceWorker\.addEventListener\('controllerchange'/);
  assert.match(worker,/\['script','style'\]\.includes\(event\.request\.destination\)/);
  assert.match(worker,/update\.catch\(\(\)=>caches\.match\(event\.request\)\)/);
  assert.match(worker,/hongjia-admin-pwa-v124/);
  assert.match(html,/assets\/app\.js\?v=180/);
});
