import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/attendance-export.js',import.meta.url),'utf8');
const cell=({r,c})=>`${String.fromCharCode(65+c)}${r+1}`;
const XLSX={utils:{
  book_new:()=>({SheetNames:[],Sheets:{}}),
  aoa_to_sheet:grid=>Object.assign({grid},...grid.flatMap((row,r)=>row.map((v,c)=>({[cell({r,c})]:v&&typeof v==='object'?v:{t:typeof v==='number'?'n':'s',v}})))),
  encode_range:({s,e})=>`${cell(s)}:${cell(e)}`,
  book_append_sheet:(book,sheet,name)=>{book.SheetNames.push(name);book.Sheets[name]=sheet}
}};
function setup(library=XLSX){const window={ERP_LAZY_LIBS:{xlsx:async()=>library}};vm.runInNewContext(source,{window,Date,Map,Set});return window.AttendanceExport}
const site={id:'site1',name:'測試案場'},month='2026-08';
const employees=[{id:'e1',employee_no:'001',full_name:'同名員工'},{id:'e2',employee_no:'002',full_name:'同名員工'},{id:'e3',employee_no:'003',full_name:'補申請員工'}];
const rows=[{id:'a',employee_id:'e1',site_id:site.id,work_date:'2026-08-30',clock_in:'2026-08-30T12:00:00Z',clock_out:'2026-08-31T00:00:00Z',status:'normal'},{id:'b',employee_id:'e2',site_id:site.id,work_date:'2026-08-31',clock_in:'2026-08-31T00:00:00Z',status:'missing'}];
const corrections=[{id:'c',employee_id:'e3',site_id:site.id,work_date:'2026-08-31',approval_status:'pending',reason:'=HYPERLINK("https://invalid.example")',requested_at:'2026-08-31T03:00:00Z',corrected_clock_in:'2026-08-31T00:00:00Z'}];
test('每位員工獨立分頁，僅有補申請者亦保留；工號及文字不轉成數字／公式',()=>{
  const book=setup().buildWorkbook(XLSX,{rows,corrections,employees,site,month});
  assert.deepEqual(book.SheetNames,['001－同名員工','002－同名員工','003－補申請員工','補打卡申請明細']);
  assert.equal(book.Sheets['001－同名員工'].B3.v,'001');
  assert.equal(book.Sheets['001－同名員工'].D7.v,12);
  assert.match(book.Sheets['001－同名員工'].D7.f,/C7-B7/);
  assert.equal(book.Sheets['002－同名員工'].D7.v,0);
  assert.equal(book.Sheets['003－補申請員工'].A7.v,'本月尚無正式打卡紀錄');
  assert.equal(book.Sheets['補打卡申請明細'].A7.v,'待審核');
  assert.equal(book.Sheets['補打卡申請明細'].K7.v,'');
  assert.equal(book.Sheets['補打卡申請明細'].I7.t,'s');
  assert.equal(book.Sheets['補打卡申請明細'].I7.f,undefined);
});
test('台灣時間與日期為可排序的 Excel 數值，保留跨日日期',()=>{
  const book=setup().buildWorkbook(XLSX,{rows,employees,site,month}),sheet=book.Sheets['001－同名員工'];
  assert.equal(sheet.A7.t,'n');
  assert.equal(sheet.A7.z,'yyyy-mm-dd');
  assert.ok(Math.abs((sheet.B7.v-sheet.A7.v)*24-20)<1e-7);
  assert.ok(Math.abs((sheet.C7.v-sheet.A7.v)*24-32)<1e-7);
  assert.match(sheet.C7.z,/yyyy-mm-dd hh:mm/);
  assert.equal(book.Sheets['補打卡申請明細'].A7.v,'本月尚無補打卡申請');
});
test('非法字元、過長與重複工作表名稱安全處理',()=>{
  const same='包含非法/[]:*?字元與很長很長很長很長很長很長的姓名';
  const book=setup().buildWorkbook(XLSX,{rows,employees:employees.map(e=>({...e,employee_no:'',full_name:same})),site,month});
  assert.equal(new Set(book.SheetNames).size,book.SheetNames.length);
  for(const name of book.SheetNames){assert.ok(name.length<=31);assert.doesNotMatch(name,/[\[\]:*?/\\]/)}
});
test('案場與月份條件套用每一批資料，超過1000筆會繼續讀取',async()=>{
  const calls=[];
  const client={from(table){const query={table,filters:[]};for(const method of ['select','eq','gte','lte','order'])query[method]=(...args)=>{query.filters.push([method,...args]);return query};query.range=async(first,last)=>{calls.push({table,filters:query.filters,first,last});return{data:first===0?Array.from({length:1000},(_,id)=>({id})):[{id:1000}],error:null}};return query}};
  const result=await setup().loadAll(client,'attendance_corrections','site1','2026-08-01','2026-08-31');
  assert.equal(result.length,1001);
  assert.deepEqual(calls.map(x=>[x.first,x.last]),[[0,999],[1000,1999]]);
  for(const call of calls){assert.ok(call.filters.some(x=>x[0]==='eq'&&x[1]==='site_id'&&x[2]==='site1'));assert.ok(call.filters.some(x=>x[0]==='gte'&&x[2]==='2026-08-01'));assert.ok(call.filters.some(x=>x[0]==='lte'&&x[2]==='2026-08-31'))}
});
test('資料讀取失敗不下載不完整檔案，按鈕恢復',async()=>{
  let writes=0;const notices=[],button={disabled:false,textContent:'下載'};
  await setup({...XLSX,writeFile:()=>writes++}).download({site,month,range:{first:'2026-08-01',last:'2026-08-31'},button,notice:(...args)=>notices.push(args),cloudEnabled:false,db:{list:async table=>{if(table==='attendance_corrections')throw Error('無法載入申請');return rows}}});
  assert.equal(writes,0);assert.equal(button.disabled,false);assert.equal(button.textContent,'下載');assert.match(notices[0][0],/無法載入申請/);
});
test('補申請單獨存在仍可匯出，並排除其他月份與案場',async()=>{
  let saved;const notices=[];
  await setup({...XLSX,writeFile:(book,name)=>{saved={book,name}}}).download({site,month,employees,range:{first:'2026-08-01',last:'2026-08-31'},notice:(...args)=>notices.push(args),cloudEnabled:false,db:{list:async table=>table==='attendance'?[]:[...corrections,{...corrections[0],employee_id:'wrong',site_id:'other'},{...corrections[0],employee_id:'wrongMonth',work_date:'2026-09-01'}]}});
  assert.equal(saved.name,'2026-08_測試案場_打卡紀錄.xlsx');
  assert.deepEqual(saved.book.SheetNames,['003－補申請員工','補打卡申請明細']);
  assert.equal(notices[0][1],'success');
});
test('原下載按鈕改接 Excel，畫面及審核模組不改分頁',()=>{
  const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(app,/window\.AttendanceExport\.download/);
  assert.doesNotMatch(app,/downloadAttendanceCsv/);
  assert.match(html,/attendance-export\.js\?v=1/);
  assert.match(app,/AttendanceCorrections\?\.attach/);
});
test('既有 Excel 元件可寫入並重新讀取真正的 xlsx 格式',{skip:!process.env.SHEETJS_TEST_PATH},()=>{
  const runtime={};vm.createContext(runtime);vm.runInContext(readFileSync(process.env.SHEETJS_TEST_PATH,'utf8'),runtime);
  const library=runtime.XLSX;
  const original=setup(library).buildWorkbook(library,{rows,corrections,employees,site,month});
  const bytes=library.write(original,{type:'buffer',bookType:'xlsx'});
  assert.ok(bytes.length>1000);
  const decoded=library.read(bytes,{type:'buffer',cellFormula:true});
  assert.equal(JSON.stringify(decoded.SheetNames),JSON.stringify(original.SheetNames));
  assert.equal(decoded.Sheets['001－同名員工'].B3.v,'001');
  assert.equal(decoded.Sheets['001－同名員工'].D7.v,12);
  assert.match(decoded.Sheets['001－同名員工'].D7.f,/C7-B7/);
  assert.equal(decoded.Sheets['補打卡申請明細'].I7.t,'s');
  assert.equal(decoded.Sheets['補打卡申請明細'].I7.f,undefined);
});
