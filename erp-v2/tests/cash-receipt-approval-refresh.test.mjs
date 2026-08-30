import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('現金班審核後完整重載並保留其他待審核操作',async()=>{
  const [app,html]=await Promise.all([read('assets/app.js'),read('index.html')]);
  const approval=app.slice(app.indexOf('async function approveCashReceipt'),app.indexOf('function decorateCashReceiptApprovals'));
  assert.match(approval,/await renderCurrent\(\)/);
  assert.doesNotMatch(approval,/await renderCashReceipts\(\)/);
  assert.match(app,/function prepareMobileTables\(\)\{decorateCashReceiptApprovals\(\)/);
  assert.match(app,/state\.cashReceiptMonth/);
  assert.match(app,/state\.cashReceiptSite/);
  assert.match(app,/state\.cashReceiptEmployee/);
  assert.match(html,/assets\/app\.js\?v=157/);
});
