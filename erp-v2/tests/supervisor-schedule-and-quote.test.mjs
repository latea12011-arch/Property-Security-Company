import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('勤務排班保留原編輯方式並提供督導唯讀按日檢視',async()=>{
  const[app,css,html]=await Promise.all([read('assets/app.js'),read('assets/app.css'),read('index.html')]);
  assert.match(app,/id="scheduleEditView">排班編輯/);
  assert.match(app,/id="scheduleSupervisorView">督導檢視/);
  assert.match(app,/function supervisorScheduleOverview/);
  assert.match(app,/督導檢視為唯讀/);
  assert.match(app,/休假／未排班/);
  assert.match(app,/renderSiteScheduleHalf/);
  assert.match(app,/saveSiteMonthlySchedule/);
  assert.match(css,/\.supervisor-schedule-view/);
  assert.match(css,/\.schedule-view-switch/);
  assert.match(html,/assets\/app\.js\?v=116/);
  assert.match(html,/assets\/app\.css\?v=66/);
});

test('競標報價可依正式服務報價單格式列印與下載且不改動資料表',async()=>{
  const[quotes,html]=await Promise.all([read('assets/tender-quotes.js'),read('index.html')]);
  for(const label of ['紘嘉物業集團','服務報價單','常駐','臨駐','增哨','業主名稱','估價名稱','估價標的','估價項目','服務項目','人員名稱','報價確認章','客戶簽認'])assert.match(quotes,new RegExp(label));
  assert.match(quotes,/function quoteDocument/);
  assert.match(quotes,/function downloadQuote/);
  assert.match(quotes,/application\/msword/);
  assert.match(quotes,/data-t-download/);
  assert.match(quotes,/hongjia-property-mark\.png/);
  assert.doesNotMatch(quotes,/\.delete\(\).*tender_quotation_items/);
  assert.match(html,/assets\/tender-quotes\.js\?v=11/);
});
