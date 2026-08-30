import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function loadBilling(){
  const source=await readFile(new URL('../assets/billing-claims.js',import.meta.url),'utf8');
  const sandbox={
    window:{ERP_CONFIG:{}},
    document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({})},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    console,crypto:{randomUUID:()=>'test-id'},Blob:function(){},
    URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},setTimeout,clearTimeout
  };
  vm.runInNewContext(source,sandbox);
  return sandbox.window.BillingClaims;
}

const base={
  issuer_company:'property',claim_no:'CLAIM-000003',issue_date:'2026-08-30',billing_month:'2026-08',due_date:'2026-09-05',
  community_name:'範例花園社區管理委員會',service_period_start:'2026-08-01',service_period_end:'2026-08-31',
  property_management_fee:127619,security_fee:0,cleaning_fee:0,equipment_fee:0,other_fee:0,
  subtotal:127619,tax_amount:6381,total_amount:134000,tax_mode:'tax_excluded',
  payment_bank:'聯邦銀行 桃園分行',payment_account_name:'紘嘉公寓大廈管理維護股份有限公司',payment_account_no:'090108900049'
};

test('社區請款單採參考服務單的上下聯版面',async()=>{
  const billing=await loadBilling(),html=billing.previewHtml([base]);
  assert.equal((html.match(/class="claim-copy"/g)||[]).length,2);
  assert.match(html,/服 務 單/);
  assert.ok(html.indexOf('收執聯')<html.indexOf('class="cut-line"'));
  assert.ok(html.indexOf('class="cut-line"')<html.indexOf('存根聯'));
  assert.match(html,/新臺幣壹拾參萬肆仟元整/);
  assert.match(html,/writing-mode:vertical-rl/);
  assert.match(html,/業務承辦人簽章/);
  assert.match(html,/會計覆核/);
  assert.match(html,/公司確認章/);
  assert.match(html,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html,/\.claim-copy\{[^}]*border:1\.8px solid #000/);
  assert.match(html,/\.copy-label\{[^}]*border:0;border-left:1\.8px solid #000/);
  assert.match(html,/\.item-list li\{[^}]*border-bottom:1\.2px solid #000/);
  assert.doesNotMatch(html,/border-bottom:1px dotted/);
  assert.match(html,/\.summary-info\{[^}]*font-size:12\.5px/);
  assert.match(html,/\.payment p:first-child,\.payment p:nth-child\(2\)\{grid-column:1\/-1\}/);
  assert.match(html,/\.payment p:nth-child\(2\)\{white-space:nowrap\}/);
  assert.match(html,/font-size:12\.5px/);
  assert.match(html,/@page\{size:A4 portrait/);
  assert.match(html,/height:140\.5mm/);
});

test('只有稅外加顯示 5% 稅金列',async()=>{
  const billing=await loadBilling(),excluded=billing.previewHtml([base]),included=billing.previewHtml([{...base,tax_mode:'tax_included',subtotal:127619,tax_amount:6381}]);
  assert.match(excluded,/<th>5% 稅金<\/th>/);
  assert.doesNotMatch(included,/<th>5% 稅金<\/th>/);
  assert.match(included,/稅內含/);
});

test('ERP 載入新版請款版型與管理端快取',async()=>{
  const[index,worker]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../admin-service-worker.js',import.meta.url),'utf8')
  ]);
  assert.match(index,/billing-claims\.js\?v=14/);
  assert.match(worker,/hongjia-admin-pwa-v102/);
});
