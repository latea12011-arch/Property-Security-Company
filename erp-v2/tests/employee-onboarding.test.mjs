import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('員工帳號首次登入自動顯示操作教學',async()=>{
  const[js,css]=await Promise.all([read('assets/mobile.js'),read('assets/mobile-enhancements.css')]);
  assert.match(js,/openEmployeeOnboarding\(\)/);
  assert.match(js,/employee_onboarding_completed_at/);
  assert.match(js,/client\.auth\.updateUser/);
  assert.match(js,/hongjia_employee_onboarding_/);
  assert.match(js,/GPS 打卡/);
  assert.match(js,/班表與紀錄/);
  assert.match(js,/請假申請/);
  assert.match(js,/薪資、密碼、守則與申訴/);
  assert.match(css,/\.employee-onboarding/);
  assert.match(css,/\.onboarding-dialog/);
});

test('更多選單可手動重新開啟教學',async()=>{
  const js=await read('assets/mobile.js');
  assert.match(js,/id='employeeTutorialButton'/);
  assert.match(js,/openEmployeeOnboarding\(true\)/);
  assert.match(js,/重新查看員工 App 操作方式/);
});
