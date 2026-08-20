import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('補打卡保留並顯示完整異動資訊',async()=>{
  const[html,module,app]=await Promise.all([read('index.html'),read('assets/attendance-corrections.js'),read('assets/app.js')]);
  assert.match(html,/attendance-corrections\.js\?v=2/);
  for(const text of ['補打卡紀錄','原上班','原下班','補登上班','補登下班','原因','操作時間','操作帳號'])assert.match(module,new RegExp(text));
  assert.match(module,/from\('attendance_corrections'\)/);
  assert.match(app,/month:state\.attendanceMonth/);
});

test('薪資明細整合常用獎金稅務及扣款欄位但保留紘嘉版型',async()=>{
  const[html,app,sql]=await Promise.all([read('index.html'),read('assets/app.js'),read('database/migration-payroll-detail-expanded.sql')]);
  assert.match(html,/assets\/app\.js\?v=124/);
  for(const field of ['holiday_overtime_pay','substitute_shift_allowance','attendance_bonus','incentive_bonus','annual_bonus','withholding_tax','supplementary_health_premium','welfare_deduction']){
    assert.match(app,new RegExp(field));assert.match(sql,new RegExp(field));
  }
  for(const text of ['應發項目','扣款項目','應發合計','扣款合計','實發金額'])assert.match(app,new RegExp(text));
  assert.match(sql,/new\.gross_pay := new\.basic_salary/);
  assert.match(sql,/new\.total_deduction :=/);
});
