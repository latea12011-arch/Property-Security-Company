import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('所有員工可允許推播且通知僅保留最近十則',async()=>{
  const [mobile,push,html,sql]=await Promise.all([
    read('assets/mobile.js'),
    read('assets/push-notifications.js'),
    read('mobile.html'),
    read('database/migration-employee-notification-retention.sql')
  ]);
  assert.match(mobile,/允許接收通知/);
  assert.match(mobile,/已允許接收通知/);
  assert.match(push,/prune_my_app_notifications/);
  assert.match(push,/mode==='employee'\?10:30/);
  assert.match(push,/rows\.slice\(0,10\)/);
  assert.match(push,/recent\.slice\(0,3\)/);
  assert.match(push,/展開其餘通知/);
  assert.match(push,/收合通知/);
  assert.match(sql,/offset safe_keep_count/);
  assert.match(sql,/offset 10/);
  assert.match(sql,/row_no > 10/);
  assert.match(sql,/after insert on public\.app_notifications/);
  assert.match(html,/assets\/push-notifications\.js\?v=7/);
  assert.match(html,/assets\/mobile\.js\?v=\d+/);
});
