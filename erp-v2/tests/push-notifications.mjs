import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('ERP 與員工 App 具備 Web Push 通知及 Windows 安裝入口',async()=>{
  const[html,mobile,app,mobileJs,push,adminWorker,employeeWorker,sql]=await Promise.all([
    read('index.html'),read('mobile.html'),read('assets/app.js'),read('assets/mobile.js'),
    read('assets/push-notifications.js'),read('admin-service-worker.js'),read('employee-service-worker.js'),
    read('database/migration-app-push-notifications.sql')
  ]);
  assert.match(html,/id="installErpButton"/);
  assert.match(app,/beforeinstallprompt/);
  assert.match(html,/assets\/push-notifications\.js/);
  assert.match(mobile,/assets\/push-notifications\.js/);
  assert.match(mobileJs,/開啟手機 App 通知/);
  assert.match(push,/pushManager\.subscribe/);
  assert.match(adminWorker,/addEventListener\('push'/);
  assert.match(employeeWorker,/addEventListener\('push'/);
  for(const type of ['daily_shift','announcement','leave_submitted','leave_reviewed','schedule_published'])assert.match(sql,new RegExp(type));
  assert.match(sql,/recipient_user_id=auth\.uid\(\)/);
  assert.match(sql,/queue_schedule_publication_notifications/);
});
