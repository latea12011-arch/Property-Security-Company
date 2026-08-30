import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('員工端借支僅供查詢，由公司紙本受理與 ERP 建檔',async()=>{
  const[html,mobile,css]=await Promise.all([
    read('mobile.html'),read('assets/mobile.js'),read('assets/mobile-enhancements.css')
  ]);
  assert.match(html,/員工借支提醒/);
  assert.match(html,/避免過度依賴借支/);
  assert.match(html,/請至公司填寫紙本申請單/);
  assert.match(html,/公司建檔紀錄/);
  assert.doesNotMatch(html,/id="advanceForm"|新增借支申請|送出借支申請/);
  assert.doesNotMatch(mobile,/submitAdvance|advanceForm/);
  assert.doesNotMatch(mobile,/from\('salary_advances'\)\.(insert|update|delete|upsert)\(/);
  assert.match(mobile,/from\('salary_advances'\)\.select\('\*'\)\.eq\('employee_id',employee.id\)/);
  assert.match(mobile,/statusLabels\[x.status\]/);
  assert.match(css,/\.advance-reminder/);
});

test('ERP 借支列印套用簽核式申請單並載入新版快取',async()=>{
  const[app,index,mobileHtml,adminWorker,employeeWorker]=await Promise.all([
    read('assets/app.js'),read('index.html'),read('mobile.html'),read('admin-service-worker.js'),read('employee-service-worker.js')
  ]);
  for(const label of ['借支申請單','提示／核准','總管理處審核','勤務主管審核','付款紀錄'])assert.match(app,new RegExp(label));
  const advance=app.slice(app.indexOf('function printAdvance(row)'),app.indexOf('function printCashReceipt('));
  assert.equal((advance.match(/class="sheet"/g)||[]).length,2);
  assert.equal((advance.match(/<h3>付款紀錄<\/h3>/g)||[]).length,2);
  assert.doesNotMatch(advance,/class="payment-record"|核辦情況|付款記錄/);
  assert.match(advance,/grid-template-rows:136mm 6mm 136mm/);
  assert.match(advance,/width:210mm;height:297mm;margin:0 auto;padding:9\.5mm 8mm/);
  assert.equal((advance.match(/class="applicant-signature"/g)||[]).length,2);
  assert.match(advance,/width:58mm;height:16mm/);
  assert.match(app,/function printAdvance\(row\)/);
  assert.match(app,/frame\.contentWindow\.print\(\)/);
  assert.match(index,/assets\/app\.js\?v=161/);
  assert.match(mobileHtml,/mobile-enhancements\.css\?v=15/);
  assert.match(mobileHtml,/assets\/mobile\.js\?v=38/);
  assert.match(adminWorker,/hongjia-admin-pwa-v102/);
  assert.match(employeeWorker,/hongjia-employee-pwa-v28/);
});
