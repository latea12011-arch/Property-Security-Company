import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('員工端可查詢本人已確認或已發薪的完整薪資明細',async()=>{
  const [mobile,html,sql,recentAccessSql]=await Promise.all([
    read('assets/mobile.js'),
    read('mobile.html'),
    read('database/migration-security-audit.sql'),
    read('database/migration-employee-recent-payroll-access.sql')
  ]);
  assert.match(mobile,/ensurePayrollUI/);
  assert.match(mobile,/dataset\.moreTab='payrollTab'/);
  assert.match(mobile,/from\('payroll_records'\)/);
  assert.match(mobile,/\.eq\('employee_id',employee\.id\)/);
  assert.match(mobile,/\.in\('status',\['confirmed','paid'\]\)/);
  for(const label of ['基本薪資','一般加班費','假日加班費','代班津貼','工作／全勤獎金','勞保','健保','借支扣回','應發合計','扣款合計','實發金額','發放方式'])assert.match(mobile,new RegExp(label));
  assert.match(mobile,/window\.BankMaster\?\.find\(row\.bank_code\)/);
  assert.match(mobile,/個人薪資請勿向其他同仁透露/);
  assert.match(mobile,/payrollWatermarks/);
  assert.match(mobile,/setupPayrollPrivacy/);
  assert.match(mobile,/visibilitychange/);
  assert.match(mobile,/帳戶末五碼/);
  assert.match(mobile,/\.gte\('payroll_month',payrollMonth\(-2\)\)/);
  assert.match(mobile,/\.lte\('payroll_month',payrollMonth\(\)\)/);
  assert.match(mobile,/\.limit\(3\)/);
  assert.match(mobile,/本系統提供近期薪資明細線上查詢；如需申請其他月份薪資明細，請洽公司辦理/);
  assert.match(sql,/employee_id=public\.current_employee_id\(\)/);
  assert.match(recentAccessSql,/status in \('confirmed', 'paid'\)/);
  assert.match(recentAccessSql,/interval '2 months'/);
  assert.match(recentAccessSql,/public\.has_feature_permission\('payroll'\)/);
  assert.match(html,/assets\/mobile\.js\?v=31/);
});
