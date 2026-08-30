import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workerPath = new URL('../../supabase/functions/create-employee-account/index.ts', import.meta.url);

test('建立員工登入前先檢查 user_id 是否已綁定其他員工', async () => {
  const worker = await readFile(workerPath, 'utf8');
  const conflictCheck = worker.indexOf(".eq('user_id', authUserId)");
  const passwordUpdate = worker.indexOf('updateUserById(authUserId');

  assert.ok(conflictCheck > -1, '缺少既有 user_id 綁定檢查');
  assert.ok(passwordUpdate > conflictCheck, '必須先檢查綁定衝突，才可以更新密碼');
  assert.match(worker, /\.neq\('id', employee\.id\)/);
  assert.match(worker, /未變更任何人的密碼/);
});

test('僅自動轉移同工號的非在職舊連結，且失敗時會復原', async () => {
  const worker = await readFile(workerPath, 'utf8');

  assert.match(worker, /sameEmployeeNo/);
  assert.match(worker, /status \|\| ''\)\.toLowerCase\(\) !== 'active'/);
  assert.match(worker, /releasedEmployeeId/);
  assert.match(worker, /update\(\{ user_id: authUserId \}\)\.eq\('id', releasedEmployeeId\)/);
  assert.match(worker, /linkError\.code === '23505'/);
});
