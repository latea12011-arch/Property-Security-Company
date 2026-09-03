import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('assets/app.js'),context={};
vm.createContext(context);
vm.runInContext(read('assets/schedule-import.js'),context);
const parseSource=app.slice(app.indexOf('  function parseImportedShift('),app.indexOf('  function importedDay('));
const timeSource=app.slice(app.indexOf('  function defaultShiftTime('),app.indexOf('  async function renderEmployeeMonthlySchedule('));
const postSource=app.match(/  const scheduleDutyPostOptions=.*;/)[0];
vm.runInContext(`${postSource}const scheduleDutyShifts=new Set(['day','night','mobile','special','cash','custom']);${timeSource}${parseSource}`,context);
const parser=context.HongJiaScheduleImport;
const employees=[{id:'e1',employee_no:'D001',full_name:'測試甲',status:'active'},{id:'e2',employee_no:'D002',full_name:'測試乙',status:'inactive'}];
const options={month:'2026-08',siteName:'測試案場',employees,parseShift:context.parseImportedShift};

test('office duty posts import and remain distinct from shift type',()=>{
  for(const [label,post] of [['總幹事','chief_manager'],['秘書','secretary']]){
    const result=parser.parse([['姓名','1'],['測試甲',`日班 ${label} 09-18`]],options);
    assert.equal(result.changes[0].post,post);assert.equal(result.changes[0].shift,'day');
    assert.ok(read('database/schema.sql').includes(`'${post}'`));
    assert.ok(read('database/migration-schedule-office-duty-posts.sql').includes(`'${post}'`));
  }
});

test('supports Gregorian and ROC dates without confusing year with day',()=>{
  for(const value of ['1','１日','8/1','8月1日','2026-08-01','115/8/1','1（六）'])assert.equal(parser.dayValue(value,'2026-08'),1,value);
  for(const value of ['2025-08-01','115/9/1','32','工號','合計'])assert.equal(parser.dayValue(value,'2026-08'),0,value);
  assert.equal(parser.dayValue('29','2026-02'),0);
  assert.equal(parser.dayValue('29','2024-02'),29);
  assert.equal(parser.monthValue('115年8月'),'2026-08');
  assert.equal(parser.monthValue('2026 年 08 月'),'2026-08');
});
test('historical names-only sheet matches former employees',()=>{
  const result=parser.parse([['月份','115年8月'],['姓名','8/1','8/2'],['測試乙','夜 19-07','婚假']],options);
  assert.equal(result.employees[0].id,'e2');
  assert.equal(result.changes[0].shift,'night');
  assert.equal(result.changes[1].shift,'marriage');
});
test('employee code aliases and old Excel date headers import correctly',()=>{
  const result=parser.parse([['員工編號','員工姓名','2026-08-01','2026-08-02'],['d001','測試甲','日班 中控 07-19','陪產檢及陪產假']],options);
  assert.equal(result.changes[0].post,'control');
  assert.equal(result.changes[1].shift,'paternity');
});
test('rejects wrong month, site, names, duplicate dates, and unknown shift before preview',()=>{
  assert.throws(()=>parser.parse([['月份','115年7月'],['姓名','1'],['測試甲','日']],options),/2026-07/);
  assert.throws(()=>parser.parse([['案場','別的社區'],['姓名','1'],['測試甲','日']],options),/案場/);
  assert.throws(()=>parser.parse([['工號','姓名','1'],['D001','測試乙','日']],options),/不一致/);
  assert.throws(()=>parser.parse([['姓名','1','8/1'],['測試甲','日','夜']],options),/重複/);
  assert.throws(()=>parser.parse([['姓名','1'],['不明人員','日']],options),/找不到員工/);
  assert.throws(()=>parser.parse([['姓名','1'],['測試甲','未定義班']],options),/無法辨識/);
  assert.throws(()=>parser.parse([['姓名','1'],['測試甲','日'],['測試甲','夜']],options),/重複/);
  assert.throws(()=>parser.parse([['姓名','1'],['測試甲','日']],{...options,employees:[...employees,{id:'e3',full_name:'測試甲'}]}),/姓名重複/);
});
test('keeps explicit empty cells and rejects files without usable dates',()=>{
  const result=parser.parse([['工號','1','2'],['D001','日','']],options);
  assert.equal(result.changes[1].shift,'');
  assert.throws(()=>parser.parse([['姓名','備註'],['測試甲','日']],options),/標題列/);
});
test('integration validates first, adds historical staff without changing assignments, and protects paid cash',()=>{
  const start=app.indexOf('  async function importSiteScheduleFile('),end=app.indexOf('  async function findScheduleConflicts(',start),importer=app.slice(start,end);
  assert.ok(importer.indexOf('parser.parse(')<importer.indexOf('appendSiteSchedulePeople('));
  assert.match(importer,/select\.dataset\.paid==='true'/);
  assert.match(app,/isHistoricalScheduleMonth\(\)\|\|x.status==='active'\|\|scheduledIds.has/);
  assert.match(app,/歷史班表已儲存/);
  assert.match(app,/不發送舊班表通知/);
  assert.match(app,/chooseScheduleImportSheet/);
  assert.match(read('index.html'),/schedule-import.js\?v=1/);
  assert.match(read('admin-service-worker.js'),/schedule-import.js/);
});

test('month picker accepts actual month values',()=>{
  const source=app.slice(app.indexOf('    monthInput.onchange='),app.indexOf("    if(state.scheduleDisplay!=='edit'||!site)return;"));
  let renders=0;const picker={value:'2025-04'},state={scheduleMonth:'2026-08'};
  vm.runInNewContext(source,{monthInput:picker,state,renderSiteMonthlySchedule:()=>renders++});
  picker.onchange();assert.equal(state.scheduleMonth,'2025-04');assert.equal(renders,1);
  picker.value='bad';picker.onchange();assert.equal(renders,1);
});

test('historical save persists records without queuing old publication notifications',async()=>{
  const source=app.slice(app.indexOf('  async function saveSiteMonthlySchedule('),app.indexOf('  const scheduleShiftOptions='));
  const calls=[],notices=[],button={};
  const cells=[
    {value:'day',dataset:{employee:'e1',date:'2025-04-01',time:'07-19'},closest:()=>null},
    {value:'cash',dataset:{employee:'e2',date:'2025-04-02',paid:'true'},closest:()=>null}
  ];
  const sandbox={cloudEnabled:true,window:{},state:{scheduleDisplay:'edit',scheduleSite:'s1',scheduleMonth:'2025-04'},
    $$:()=>cells,$:()=>button,scheduleDutyShifts:new Set(['day','cash']),parseShiftTime:context.parseShiftTime,
    findScheduleConflicts:async()=>[],confirm:()=>true,isHistoricalScheduleMonth:()=>true,
    showNotice:text=>notices.push(text),renderSiteMonthlySchedule:async()=>{},
    client:{rpc:async(name,payload)=>{calls.push({name,payload});return{data:1,error:null}}}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  await sandbox.saveSiteMonthlySchedule(employees,{id:'s1',name:'測試案場'});
  assert.equal(calls.length,1);assert.equal(calls[0].name,'replace_site_month_schedules');
  assert.equal(calls[0].payload.target_month,'2025-04-01');
  assert.equal(calls[0].payload.schedule_records.length,1);
  assert.match(notices[0],/歷史班表已儲存/);
});

test('demo save preserves paid cash and unrelated records',async()=>{
  const source=app.slice(app.indexOf('  async function saveSiteMonthlySchedule('),app.indexOf('  const scheduleShiftOptions='));
  const paid={id:'paid',site_id:'s1',work_date:'2025-04-02',shift_type:'cash',cash_payment_status:'paid'},
    other={id:'other',site_id:'s2',work_date:'2025-04-01'},later={id:'later',site_id:'s1',work_date:'2026-09-01'},
    demo={schedules:[paid,other,later,{id:'replace',site_id:'s1',work_date:'2025-04-01'}],attendance:[{id:'untouched'}]};
  let saved;
  const sandbox={cloudEnabled:false,window:{ERP_DEMO_MODE:true},state:{scheduleDisplay:'edit',scheduleSite:'s1',scheduleMonth:'2025-04'},
    $$:()=>[{value:'day',dataset:{employee:'e1',date:'2025-04-01',time:'07-19'},closest:()=>null}],
    scheduleDutyShifts:new Set(['day']),parseShiftTime:context.parseShiftTime,confirm:()=>true,
    demoData:()=>demo,demoKey:'test',monthRange:()=>({last:'2025-04-30'}),crypto:{randomUUID:()=> 'new'},
    localStorage:{setItem:(key,value)=>{saved=JSON.parse(value)}},showNotice:()=>{},renderSiteMonthlySchedule:async()=>{}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  await sandbox.saveSiteMonthlySchedule(employees,{name:'測試案場'});
  assert.deepEqual(saved.schedules.map(x=>x.id),['paid','other','later','new']);
  assert.deepEqual(saved.attendance,[{id:'untouched'}]);
});
