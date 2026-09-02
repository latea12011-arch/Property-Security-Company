import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('  async function ensureScheduleSiteAssignment('),app.indexOf('  function installScheduleArchiveTools('));
const employee={id:'e1',role:'employee'},site={id:'s1'};
function fixture({existing=[],queryError=null,insertError=null,recheck=[]}={}){
  const writes=[],queries=[];let count=0;
  const context={window:{},cloudEnabled:true,client:{from:table=>{
    assert.equal(table,'site_assignments');const filters={};
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},limit:async()=>{queries.push(filters);return {data:count++?recheck:existing,error:queryError}},insert:async row=>{writes.push(row);return {error:insertError}}};return query;
  }}};
  vm.createContext(context);vm.runInContext(source,context);return {context,writes,queries};
}
test('adds only the requested employee/site with selected month start',async()=>{
  const {context,writes,queries}=fixture();await context.ensureScheduleSiteAssignment(employee,site,'2026-08-01');
  assert.deepEqual(queries,[{employee_id:'e1',site_id:'s1'}]);
  assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{employee_id:'e1',site_id:'s1',start_date:'2026-08-01',is_manager:false}]);
});
test('existing relation is preserved without changing dates or duplicating',async()=>{
  const {context,writes}=fixture({existing:[{id:'existing'}]});await context.ensureScheduleSiteAssignment(employee,site,'2026-08-01');assert.equal(writes.length,0);
});
test('read and write failures stop addition',async()=>{
  for(const options of [{queryError:Error('read failed')},{insertError:Error('write failed')}]){
    const {context}=fixture(options);await assert.rejects(context.ensureScheduleSiteAssignment(employee,site,'2026-08-01'),/failed/);
  }
});
test('concurrent duplicate succeeds only after relation is verified',async()=>{
  const {context}=fixture({insertError:{code:'23505'},recheck:[{id:'concurrent'}]});await context.ensureScheduleSiteAssignment(employee,site,'2026-08-01');
  const failed=fixture({insertError:{code:'23505'}});await assert.rejects(failed.context.ensureScheduleSiteAssignment(employee,site,'2026-08-01'));
});
test('demo relation is idempotent and preserves other sites',async()=>{
  const data={site_assignments:[{id:'old',employee_id:'e1',site_id:'s2'}]};let saves=0;
  const context={window:{ERP_DEMO_MODE:true},demoData:()=>data,demoKey:'test',crypto:{randomUUID:()=> 'new'},localStorage:{setItem:()=>saves++}};
  vm.createContext(context);vm.runInContext(source,context);
  await context.ensureScheduleSiteAssignment(employee,site,'2026-08-01');await context.ensureScheduleSiteAssignment(employee,site,'2026-08-01');
  assert.equal(data.site_assignments.length,2);assert.equal(data.site_assignments[0].site_id,'s2');assert.equal(saves,1);
});
test('button waits for assignment persistence before adding editor row',()=>{
  const handler=app.slice(app.indexOf('    add.onclick=async()=>'),app.indexOf('    const assignmentNote='));
  assert.ok(handler.indexOf('await ensureScheduleSiteAssignment(')<handler.indexOf('appendSiteSchedulePeople('));
  assert.match(handler,/toolbar.isConnected/);assert.match(handler,/state.scheduleMonth!==month/);assert.match(handler,/add.disabled=true/);
});
