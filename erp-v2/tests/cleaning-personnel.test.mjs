import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');

test('清潔人員面試履歷可勾選合併下載或列印',()=>{
  const documents=read('assets/employee-documents.js');
  const form=fs.readFileSync(new URL('assets/employee-documents/cleaning-personnel-interview-form.pdf',root));
  assert.match(documents,/\['清潔人員應徵履歷暨面試紀錄表','assets\/employee-documents\/cleaning-personnel-interview-form\.pdf'\]/);
  assert.match(documents,/data-employee-document/);
  assert.match(documents,/下載勾選 PDF/);
  assert.match(documents,/列印勾選 PDF/);
  assert.doesNotMatch(documents,/清潔人員面試履歷表下載（Word）/);
  assert.equal(form.subarray(0,4).toString(),'%PDF');
  assert.ok(form.length>10000);
});

test('員工職稱與排班哨別均提供清潔人員',()=>{
  const app=read('assets/app.js');
  const schema=read('database/schema.sql');
  const migration=read('database/migration-cleaning-personnel.sql');
  assert.match(app,/\['清潔人員','清潔人員'\]/);
  assert.match(app,/\['cleaner','清潔人員'\]/);
  assert.match(schema,/'cleaner'/);
  assert.match(migration,/'cleaner'/);
});
