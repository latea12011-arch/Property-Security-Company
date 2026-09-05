import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('assets/app.js',root),'utf8');

test('面試履歷提供勞保、健保、團保與其他加保勾選欄位',()=>{
  assert.match(app,/<th>是否可以加保<br>勞健團保<\/th><td colspan="5" class="check-line">□ 勞保　□ 健保　□ 團保　□ 其他：________<\/td>/);
  assert.ok(app.indexOf('是否可接受<br>警局核備')<app.indexOf('是否可以加保<br>勞健團保'));
  assert.ok(app.indexOf('是否可以加保<br>勞健團保')<app.indexOf('三、學歷'));
});
