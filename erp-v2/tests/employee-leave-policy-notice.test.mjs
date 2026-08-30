import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('事假與病假顯示自訂提前告知提醒',async()=>{
  const[html,js,css]=await Promise.all([read('mobile.html'),read('assets/mobile.js'),read('assets/mobile-enhancements.css')]);
  assert.match(js,/N＋2 天/);
  assert.match(js,/開始日前至少 2 天/);
  assert.match(js,/N＋12H/);
  assert.match(js,/開始前至少 12 小時/);
  assert.match(js,/showLeavePolicyNotice/);
  assert.match(js,/如遇突發或緊急狀況，仍可送出申請/);
  assert.match(css,/\.leave-policy-backdrop/);
  assert.match(css,/\.leave-policy-dialog/);
  assert.match(html,/mobile-enhancements\.css\?v=12/);
  assert.match(html,/assets\/mobile\.js\?v=35/);
});

test('員工 PWA 使用新的快取版本',async()=>{
  const[worker,standalone,index]=await Promise.all([
    read('employee-service-worker.js'),
    readFile(new URL('../../employee-app/service-worker.js',import.meta.url),'utf8'),
    readFile(new URL('../../employee-app/index.html',import.meta.url),'utf8')
  ]);
  assert.match(worker,/hongjia-employee-pwa-v25/);
  assert.match(standalone,/hongjia-standalone-employee-v15/);
  assert.match(index,/employee-app-v15/);
});
