import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const gate=app.match(/  const demoAllowed=.*;/)[0];
const entry=app.slice(app.indexOf('  function enterApp('),app.indexOf('  async function logout('));
const dataFunction=app.slice(app.indexOf('  function demoData('),app.indexOf('  const db ='));
test('production and ordinary localhost visits cannot enable demo',()=>{
  for(const [hostname,cloudEnabled,flag,expected] of [['latea12011-arch.github.io',false,true,false],['latea12011-arch.github.io',true,true,false],['localhost',false,false,false],['127.0.0.1',false,true,true],['localhost',true,true,false]]){
    const actual=vm.runInNewContext(`${gate}\ndemoAllowed`,{location:{hostname},cloudEnabled,window:{ERP_LOCAL_TEST_DEMO:flag}});assert.equal(actual,expected);
  }
});
test('demo entry is rejected before revealing app or granting synthetic admin',()=>{
  const message={},state={user:null};const context={demoAllowed:false,cloudEnabled:true,state,$:selector=>{assert.equal(selector,'#loginMessage');return message}};
  vm.createContext(context);vm.runInContext(entry,context);context.enterApp(true);assert.match(message.textContent,/已停用/);assert.equal(state.user,null);
});
test('unauthenticated entry and offline data fallback fail closed',()=>{
  const message={},context={demoAllowed:false,cloudEnabled:false,state:{user:null},$:()=>message};
  vm.createContext(context);vm.runInContext(entry+dataFunction,context);context.enterApp();assert.match(message.textContent,/正式帳號/);assert.throws(()=>context.demoData(),/正式資料/);
});
test('login page has no demo button and login retains password authentication',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/使用示範模式|demoButton|demoBtn/);assert.match(app,/client.auth.signInWithPassword/);assert.doesNotMatch(app,/請改用示範模式/);
});
