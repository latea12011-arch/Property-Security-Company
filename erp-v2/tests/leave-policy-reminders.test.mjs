import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const mobile=fs.readFileSync(new URL('../assets/mobile.js',import.meta.url),'utf8');
const start=mobile.indexOf('const leavePolicyNotices='),end=mobile.indexOf('\n};',start)+3;
const notices=vm.runInNewContext(mobile.slice(start,end).replace('const leavePolicyNotices=','result=')+'\nresult');
const expected={marriage:'婚假申請提醒',bereavement:'喪假申請提醒',maternity:'產假申請提醒',paternity:'陪產檢及陪產假提醒',menstrual:'生理假申請提醒'};
test('requested leave types each have a visible reminder',()=>{
  for(const [type,title] of Object.entries(expected)){
    assert.equal(notices[type].title,title);assert.ok(notices[type].code);assert.ok(notices[type].message.length>=25);
  }
});
test('existing personal and sick timing reminders remain unchanged',()=>{
  assert.equal(notices.personal.code,'N＋2 天');assert.match(notices.personal.message,/至少 2 天/);
  assert.equal(notices.sick.code,'N＋12H');assert.match(notices.sick.message,/至少 12 小時/);
});
test('selection updates inline reminder before opening dialog',()=>{
  const body=mobile.slice(mobile.indexOf('function showLeavePolicyNotice('),mobile.indexOf('\nlet onboardingStep'));
  assert.ok(body.indexOf('updateLeavePolicyHint(type)')<body.indexOf('ensureLeavePolicyDialog()'));
  assert.match(mobile,/updateLeavePolicyHint\(formElement\.elements\.leave_type\.value\)/);
});
test('employee page contains every requested leave option',()=>{
  const html=fs.readFileSync(new URL('../mobile.html',import.meta.url),'utf8');
  for(const type of Object.keys(expected))assert.match(html,new RegExp(`<option value="${type}">`));
  assert.match(html,/assets\/mobile\.js\?v=41/);
});
