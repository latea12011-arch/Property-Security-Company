import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');

test('ERP 不再顯示或載入公司郵件功能', () => {
  const sources = [
    read('index.html'),
    read('assets/app.js'),
    read('assets/app.css'),
    read('admin-service-worker.js')
  ].join('\n');

  assert.doesNotMatch(sources, /gmailMailbox|gmail-mailbox|公司郵件中心|COMPANY MAIL/i);
  assert.equal(existsSync(join(root, 'assets/gmail-mailbox.js')), false);
});
