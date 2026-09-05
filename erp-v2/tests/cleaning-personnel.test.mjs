import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');

test('清潔人員面試履歷可從面試新進文件下載',()=>{
  const documents=read('assets/employee-documents.js');
  const form=fs.readFileSync(new URL('assets/employee-documents/cleaning-personnel-interview-form.docx',root));
  assert.match(documents,/cleaning-personnel-interview-form\.docx/);
  assert.match(documents,/清潔人員面試履歷表下載（Word）/);
  assert.match(documents,/download="紘嘉_清潔人員應徵履歷暨面試紀錄表\.docx"/);
  assert.equal(form.subarray(0,2).toString(),'PK');
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
