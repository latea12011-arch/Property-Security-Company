import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderTermination} from './termination-print-layout.test.mjs';

const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
test('員工職稱與離職職務均可選擇行政保全，原有選項保留',()=>{
  for(const [field,next] of [['job_title','案場主任'],['job_description','系統保全勤務']]){
    const match=source.match(new RegExp("\\['"+field+"','[^']+','select',true,(\\[[\\s\\S]*?\\])\\],"));
    assert.ok(match,field);
    const options=vm.runInNewContext(match[1]);
    assert.equal(options.filter(([value,label])=>value==='行政保全'&&label==='行政保全').length,1);
    assert.ok(options.some(([value])=>value===next));
  }
});
test('員工行政保全職稱可顯示於離職證明',()=>{
  assert.match(renderTermination('security',{job_title:'行政保全'}),/<th>職稱<\/th><td>行政保全<\/td>/);
});
