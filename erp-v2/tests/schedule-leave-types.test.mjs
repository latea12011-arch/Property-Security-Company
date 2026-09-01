import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../assets/mobile.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../database/schema.sql',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../database/migration-schedule-all-leave-types.sql',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const mobileHtml=fs.readFileSync(new URL('../mobile.html',import.meta.url),'utf8');

const leaveTypes={
  marriage:'婚假',bereavement:'喪假',maternity:'產假',paternity:'陪產檢及陪產假',
  menstrual:'生理假',occupational:'公傷病假',compensatory:'補休',unpaid:'無薪假',
  typhoon_unpaid:'天然災害未出勤（不支薪）',other:'其他'
};

for(const [code,label] of Object.entries(leaveTypes)){
  const option=`['${code}','${label}']`;
  assert.ok(app.split(option).length>=4,`${label} must appear in every ERP schedule option source`);
  assert.ok(mobile.includes(`${code}:'${label}'`),`${label} must display in the employee app`);
  assert.ok(schema.includes(`'${code}'`),`${code} must be accepted by the base schema`);
  assert.ok(migration.includes(`'${code}'`),`${code} must be accepted by the migration`);
  assert.ok(css.includes(`.site-shift-cell.${code}`),`${code} must have site schedule styling`);
  assert.ok(css.includes(`.supervisor-month-cell.${code}`),`${code} must have supervisor styling`);
}

const dutyLine=app.match(/const scheduleDutyShifts=new Set\((\[[^;]+\])\)/)?.[1]||'';
for(const code of Object.keys(leaveTypes))assert.ok(!dutyLine.includes(`'${code}'`),`${code} must not be treated as a duty shift`);

assert.ok(app.indexOf('/陪產檢及陪產假|陪產假|paternity/')<app.indexOf('/產假|maternity/'),'paternity must be parsed before maternity');
assert.ok(app.indexOf('/公傷病假|職災|occupational/')<app.indexOf('/公假|official/'),'occupational leave must be parsed before official leave');
assert.match(migration,/drop constraint if exists schedules_shift_type_check/);
assert.match(index,/assets\/app\.css\?v=88/);
assert.match(index,/assets\/app\.js\?v=166/);
assert.match(mobileHtml,/assets\/mobile\.js\?v=39/);

console.log('schedule leave types checks passed');
