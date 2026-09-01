import assert from 'node:assert/strict';
import fs from 'node:fs';

const mobile=fs.readFileSync(new URL('../assets/mobile.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../database/migration-attendance-server-time.sql',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../mobile.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../employee-service-worker.js',import.meta.url),'utf8');

assert.match(mobile,/function isPermanentPunchError\(message\)/);
assert.match(mobile,/時間差距過大/);
assert.match(mobile,/archiveRejectedPunch\(item,reason\)/);
assert.match(mobile,/queue\.shift\(\);writePunchQueue\(queue\);rejected\+\+;continue/);
assert.match(mobile,/client\.rpc\('attendance_server_time'\)/);
assert.match(mobile,/time:punchTime/);
assert.match(mobile,/已轉存待補登紀錄/);
assert.match(migration,/create or replace function public\.attendance_server_time\(\)/);
assert.match(migration,/grant execute on function public\.attendance_server_time\(\) to authenticated/);
assert.match(html,/assets\/mobile\.js\?v=40/);
assert.match(worker,/hongjia-employee-pwa-v31/);

console.log('attendance punch queue recovery checks passed');
