import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('員工端可查詢本人已確認或已發薪的完整薪資明細',async()=>{
  const [mobile,html,sql]=await Promise.all([
    read('assets/mobile.js'),
    read('mobile.html'),
    read('database/migration-security-audit.sql')
  ]);
  assert.match(mobile,/ensurePayrollUI/);
  assert.match(mobile,/dataset\.moreTab='payrollTab'/);
  assert.match(mobile,/from\('payroll_records'\)/);
  assert.match(mobile,/\.eq\('employee_id',employee\.id\)/);
  assert.match(mobile,/\.in\('status',\['confirmed','paid'\]\)/);
  for(const label of ['基本薪資','一般加班費','假日加班費','代班津貼','工作／全勤獎金','勞保','健保','借支扣回','應發合計','扣款合計','實發金額','發放方式'])assert.match(mobile,new RegExp(label));
  assert.match(mobile,/window\.BankMaster\?\.find\(row\.bank_code\)/);
  assert.match(sql,/employee_id=public\.current_employee_id\(\)/);
  assert.match(html,/assets\/mobile\.js\?v=29/);
});
