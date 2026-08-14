import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('督導檢視顯示所選案場整月全員班表，排班編輯維持不變',async()=>{
  const[app,css,html]=await Promise.all([read('assets/app.js'),read('assets/app.css'),read('index.html')]);
  assert.match(app,/id="scheduleEditView">排班編輯/);
  assert.match(app,/id="scheduleSupervisorView">督導檢視/);
  assert.match(app,/function renderSupervisorScheduleMonth/);
  assert.match(app,/當月份全部執勤人員/);
  assert.match(app,/整月唯讀檢視/);
  assert.doesNotMatch(app,/id="supervisorScheduleDate"/);
  assert.match(app,/renderSiteScheduleHalf/);
  assert.match(app,/saveSiteMonthlySchedule/);
  assert.match(css,/\.supervisor-month-table/);
  assert.match(css,/\.supervisor-mobile-hint/);
  assert.match(css,/\.supervisor-month-cell b\{font-size:14px\}/);
  assert.match(app,/scheduleDisplay==='edit'\?`<button class="btn ghost" id="printSiteSchedule"/);
  assert.match(css,/\.supervisor-month-cell/);
  assert.match(html,/assets\/app\.js\?v=119/);
  assert.match(html,/assets\/app\.css\?v=69/);
});

test('正式報價單提供大型用印區並抑制瀏覽器列印網址頁尾',async()=>{
  const[quotes,html]=await Promise.all([read('assets/tender-quotes.js'),read('index.html')]);
  assert.match(quotes,/function quoteDocument/);
  assert.match(quotes,/@page\{size:A4 portrait;margin:0\}/);
  assert.match(quotes,/紘嘉物業集團用印/);
  assert.match(quotes,/客戶／管委會用印/);
  assert.match(quotes,/公司用印處/);
  assert.match(quotes,/客戶用印處/);
  assert.match(quotes,/聯絡人姓名/);
  assert.match(quotes,/聯絡人電話/);
  assert.match(quotes,/function quoteContact/);
  assert.match(quotes,/letter-spacing:14px/);
  assert.match(quotes,/\.quote-title b\{font-size:15px/);
  assert.match(quotes,/\.totals td\{border:0/);
  assert.match(quotes,/\.quote-head\{display:grid;grid-template-columns:116px 1fr\}/);
  assert.match(quotes,/application\/msword/);
  assert.match(quotes,/data-t-download/);
  assert.match(quotes,/hongjia-property-mark\.png/);
  assert.doesNotMatch(quotes,/\.delete\(\).*tender_quotation_items/);
  assert.match(html,/assets\/tender-quotes\.js\?v=14/);
});
