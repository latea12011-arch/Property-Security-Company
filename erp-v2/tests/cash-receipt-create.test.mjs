import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('  function cashReceiptRecord('),app.indexOf('  function openCashReceiptCreate('));
const values={employee_id:'e1',site_id:'s1',work_date:'2026-08-16',start_time:'19:00',end_time:'07:00',cash_amount:'2000'};
function setup(existing=[],queryError=null,insertError=null){
  const writes=[];
  const context={state:{relations:{employees:[{id:'e1'}],sites:[{id:'s1'}]}},window:{},cloudEnabled:true,
    scheduleDutyShifts:new Set(['day','night','mobile','cash','special','custom']),client:{from:table=>{
      assert.equal(table,'schedules');let inserting=false;
      const query={select:()=>query,eq:()=>query,then:resolve=>resolve({data:existing,error:queryError}),insert:row=>{inserting=true;writes.push(row);return query},single:async()=>({data:inserting?{id:'new',...writes[0]}:null,error:insertError})};return query;
    }}};
  vm.createContext(context);vm.runInContext(source,context);return{context,writes};
}
test('validates identities, date, time and amount before saving',()=>{
  const {context}=setup();
  for(const change of [{employee_id:'missing'},{site_id:''},{work_date:'2026-02-30'},{start_time:'25:00'},{end_time:'19:00'},{cash_amount:''},{cash_amount:'0'},{cash_amount:'-1'},{cash_amount:'1.5'},{cash_amount:'NaN'}])assert.throws(()=>context.cashReceiptRecord({...values,...change}));
  assert.equal(context.cashReceiptRecord(values).end_time,'07:00');
});
test('inserts cash schedule pending approval, never paid',async()=>{
  const {context,writes}=setup();const result=await context.createCashReceipt(values);
  assert.equal(result.id,'new');assert.equal(writes.length,1);assert.equal(writes[0].shift_type,'cash');assert.equal(writes[0].cash_payment_status,'pending');assert.equal(writes[0].cash_amount,2000);assert.equal('cash_paid_at' in writes[0],false);
});
test('rejects existing same-site records including paid cash without modifying them',async()=>{
  for(const shift_type of ['cash','day']){const {context,writes}=setup([{site_id:'s1',shift_type,start_time:'07:00',cash_payment_status:'paid'}]);await assert.rejects(context.createCashReceipt(values),/已有班表/);assert.equal(writes.length,0);}
});
test('rejects leave and concurrent same start time elsewhere',async()=>{
  for(const row of [{site_id:'s2',shift_type:'annual',start_time:'00:00'},{site_id:'s2',shift_type:'night',start_time:'19:00:00'}]){const {context,writes}=setup([row]);await assert.rejects(context.createCashReceipt(values),/休假或相同/);assert.equal(writes.length,0);}
});
test('propagates database failures and converts duplicate race to actionable error',async()=>{
  const read=setup([],Error('read failed'));await assert.rejects(read.context.createCashReceipt(values),/read failed/);assert.equal(read.writes.length,0);
  const duplicate=setup([],null,{code:'23505'});await assert.rejects(duplicate.context.createCashReceipt(values),/相同日期與時段/);
});
test('demo adds once and retains unrelated records',async()=>{
  const {context}=setup();context.window.ERP_DEMO_MODE=true;const data={schedules:[{id:'old',employee_id:'e2',work_date:'2026-08-16'}]};context.demoData=()=>data;context.crypto={randomUUID:()=> 'new'};context.demoKey='test';context.localStorage={setItem:()=>{}};
  await context.createCashReceipt(values);await assert.rejects(context.createCashReceipt(values),/已有班表/);assert.equal(data.schedules.length,2);assert.equal(data.schedules[0].id,'old');
});
test('new button uses existing print and approval list and guards double submit',()=>{
  assert.match(app,/id="createCashReceipt"/);assert.match(app,/saving\|\|!form.reportValidity/);assert.match(app,/領取單已儲存，但列表更新失敗/);assert.match(app,/data-cash-print/);
});
