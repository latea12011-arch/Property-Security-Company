import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  const terminationCompanyMarker='),source.indexOf('  function employmentCertificateBody('));
export function renderTermination(companyType='property',employeeOverrides={}){
  const frame={};
  const context={
    state:{relations:{employees:[{id:'sample',full_name:'測試員工',national_id:'A123456789',phone:'0912-345678',birth_date:'1982-11-23',hire_date:'2024-04-16',registered_address:'桃園市八德區範例路一段100號10樓',job_title:'社區秘書',...employeeOverrides}]}},
    document:{createElement:()=>frame,body:{appendChild:()=>{}}},
    esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    setTimeout:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(code,context);
  context.printTermination({employee_id:'sample',company_type:companyType,issue_date:'2026-08-31',separation_date:'2026-08-31',certificate_no:'HJ-TERM-SAMPLE',separation_reason:'自願離職'});
  return frame.srcdoc;
}

test('離職證明採 A4 單頁、統一欄寬與可黏貼實體身分證尺寸',()=>{
  const html=renderTermination();
  assert.match(html,/size:A4 portrait;margin:10mm/);
  assert.match(html,/width:190mm;margin:0 auto/);
  assert.match(html,/font-size:10pt;line-height:1\.45/);
  assert.match(html,/grid-template-columns:28mm minmax\(0,1fr\)/);
  assert.match(html,/class="label-col"/);
  assert.match(html,/height:55mm/);
  assert.equal((html.match(/class="id-copy"/g)||[]).length,2);
  assert.match(html,/width:62mm;height:8mm/);
  assert.match(html,/width:80mm;height:9mm/);
  assert.doesNotMatch(html,/float:right|font-size:10\.5px/);
});
test('保留兩間公司、員工資料、原有勾選內容',()=>{
  const property=renderTermination(),security=renderTermination('security');
  assert.match(property,/紘嘉公寓大廈管理維護股份有限公司/);
  assert.match(property,/70409141/);
  assert.doesNotMatch(property,/94012985/);
  assert.match(security,/紘嘉保全股份有限公司/);
  assert.match(security,/94012985/);
  for(const label of ['測試員工','113 年 4 月 16 日','115 年 8 月 31 日','非自願離職或依法終止','主管機關','自行釋明','身分證正面','身分證反面'])assert.ok(property.includes(label),label);
  assert.match(property,/☑<\/b>自願離職/);
});
test('列印資料安全編碼，空白資料仍可產生',()=>{
  assert.match(renderTermination('security',{full_name:'<script>測試</script>'}),/&lt;script&gt;/);
  assert.ok(renderTermination('security',{hire_date:null,birth_date:null,registered_address:''}));
});

if(process.env.TERMINATION_PREVIEW_DIR){
  const dir=process.env.TERMINATION_PREVIEW_DIR;
  mkdirSync(dir,{recursive:true});
  writeFileSync(`${dir}/termination-preview.html`,renderTermination());
  writeFileSync(`${dir}/termination-long-preview.html`,renderTermination('security',{full_name:'測試長姓名員工',registered_address:'桃園市八德區範例路一段100號10樓之二（此為長地址排版測試資料，並非真實個人資料）',job_title:'社區總幹事兼行政管理'}));
}
