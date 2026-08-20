import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('補打卡須申請審核且核准後才更新正式紀錄',async()=>{
  const[html,module,app,sql]=await Promise.all([read('index.html'),read('assets/attendance-corrections.js'),read('assets/app.js'),read('database/migration-attendance-correction-approval.sql')]);
  assert.match(html,/attendance-corrections\.js\?v=3/);
  for(const text of ['補打卡申請與審核','待審核','核准','退回','原上班','原下班','申請上班','申請下班','審核備註'])assert.match(module,new RegExp(text));
  assert.match(module,/from\('attendance_corrections'\)/);
  assert.match(module,/review_attendance_correction/);
  assert.match(app,/month:state\.attendanceMonth/);
  assert.match(app,/user:state\.user/);
  assert.match(sql,/approval_status='pending'/);
  assert.match(sql,/申請人不可審核自己的補打卡申請/);
  assert.match(sql,/if decision='approved' then/);
});

test('薪資明細整合常用獎金稅務及扣款欄位但保留紘嘉版型',async()=>{
  const[html,app,sql]=await Promise.all([read('index.html'),read('assets/app.js'),read('database/migration-payroll-detail-expanded.sql')]);
  assert.match(html,/assets\/app\.js\?v=125/);
  for(const field of ['holiday_overtime_pay','substitute_shift_allowance','attendance_bonus','incentive_bonus','annual_bonus','withholding_tax','supplementary_health_premium','welfare_deduction']){
    assert.match(app,new RegExp(field));assert.match(sql,new RegExp(field));
  }
  for(const text of ['應發項目','扣款項目','應發合計','扣款合計','實發金額'])assert.match(app,new RegExp(text));
  assert.match(sql,/new\.gross_pay := new\.basic_salary/);
  assert.match(sql,/new\.total_deduction :=/);
});
