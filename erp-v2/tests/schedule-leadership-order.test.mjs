import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('案場排班將總幹事與秘書固定排在最上方',async()=>{
  const [app,html]=await Promise.all([read('assets/app.js'),read('index.html')]);
  assert.match(app,/function siteScheduleEmployeeOrder\(employee\)/);
  assert.match(app,/title\.includes\('總幹事'\)\?0:title\.includes\('秘書'\)\?1:2/);
  assert.match(app,/function sortSiteScheduleEmployees\(a,b\)/);
  assert.ok((app.match(/sort\(sortSiteScheduleEmployees\)/g)||[]).length>=3,'畫面、列印與下載均須套用主管排序');
  assert.match(html,/assets\/app\.js\?v=158/);
});
