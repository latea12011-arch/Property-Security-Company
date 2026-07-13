import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('員工端保留通知中心且不顯示薪資資料',async()=>{const[html,js]=await Promise.all([read('mobile.html'),read('assets/mobile.js')]);assert.doesNotMatch(html,/id="payrollTab"/);assert.doesNotMatch(js,/payroll_records|loadPayroll|printEmployeePayroll/);assert.match(js,/loadEmployeeNotifications/);assert.match(js,/ERP_CALENDAR/)});
test('打卡具備離線佇列、冪等收據與 GPS 精度限制',async()=>{const js=await read('assets/mobile.js');assert.match(js,/punchQueueKey/);assert.match(js,/requestId:crypto\.randomUUID/);assert.match(js,/accuracy\|\|0\)>300/);assert.match(js,/submit_attendance_punch/)});
test('ERP 使用共用雲端連線並有健康檢查',async()=>{const[config,app]=await Promise.all([read('config.js'),read('assets/app.js')]);assert.match(config,/ERP_CLIENT/);assert.match(app,/checkSystemHealth/);assert.match(app,/attendance_punch_receipts/)});
