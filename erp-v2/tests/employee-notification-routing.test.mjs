import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../employee-service-worker.js',import.meta.url),'utf8');
async function click(target,windows=[],worker='https://latea12011-arch.github.io/Property-Security-Company/erp-v2/employee-service-worker.js'){
  const handlers={},opened=[];
  vm.runInNewContext(source,{
    URL,
    self:{location:new URL(worker),addEventListener:(type,handler)=>{handlers[type]=handler}},
    clients:{matchAll:async()=>windows,openWindow:async url=>{opened.push(url)}}
  });
  let work,closed=false;
  handlers.notificationclick({notification:{data:{url:target},close:()=>{closed=true}},waitUntil:promise=>{work=promise}});
  await work;
  assert.equal(closed,true);
  return opened;
}
const app='https://latea12011-arch.github.io/Property-Security-Company/erp-v2/mobile.html';
test('relative, legacy root, and external payloads stay in employee app',async()=>{
  for(const target of ['./mobile.html?tab=homeTab','https://latea12011-arch.github.io/mobile.html?tab=homeTab','https://example.com/mobile.html?tab=homeTab']){
    assert.deepEqual(await click(target),[`${app}?tab=homeTab`]);
  }
});
test('missing and malformed targets open the employee home',async()=>{
  for(const target of [undefined,'http://['])assert.deepEqual(await click(target),[app]);
});
test('existing employee window navigates before focusing; other project is untouched',async()=>{
  const calls=[];
  const other={url:'https://latea12011-arch.github.io/other/erp-v2/mobile.html',navigate:()=>assert.fail('wrong project')};
  const current={url:app+'?tab=leaveTab',navigate:async url=>{calls.push(url);return{focus:async()=>{calls.push('focus')}}}};
  assert.deepEqual(await click('./mobile.html?tab=homeTab',[other,current]),[]);
  assert.deepEqual(calls,[app+'?tab=homeTab','focus']);
});
test('failed navigation opens correct app window',async()=>{
  assert.deepEqual(await click(undefined,[{url:app,navigate:async()=>null}]),[app]);
});
test('root deployment retains erp-v2 directory too',async()=>{
  assert.deepEqual(await click('./mobile.html?tab=homeTab',[],'https://example.com/erp-v2/employee-service-worker.js'),['https://example.com/erp-v2/mobile.html?tab=homeTab']);
});
