import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const module=fs.readFileSync(new URL('../assets/site-profitability.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../database/migration-site-profitability.sql',import.meta.url),'utf8');

test('案場損益依排班比例分攤薪資並計入現金班、勞退及其他成本',()=>{
  const start=module.indexOf('function calculate()');
  const end=module.indexOf('function totals()',start);
  assert.ok(start>=0&&end>start);
  const context={};
  vm.runInNewContext(`
    let sites=[{id:'a',code:'A',name:'甲案場'},{id:'b',code:'B',name:'乙案場'}];
    let claims=[{site_id:'a',subtotal:100000}];
    let schedules=[
      {employee_id:'e1',site_id:'a',shift_type:'day'},
      {employee_id:'e1',site_id:'a',shift_type:'night'},
      {employee_id:'e1',site_id:'b',shift_type:'day'},
      {employee_id:'cash',site_id:'a',shift_type:'cash',cash_amount:5000}
    ];
    let payroll=[{employee_id:'e1',gross_pay:51000,personal_leave_deduction:1000,sick_leave_deduction:0,unpaid_leave_deduction:0}];
    let profiles=[{employee_id:'e1',pension_contribution:3000}];
    let adjustments=[{site_id:'a',revenue_adjustment:1000,personnel_adjustment:500,employer_insurance_cost:1000,supplies_cost:2000,equipment_cost:0,subcontract_cost:0,transportation_cost:0,administrative_allocation:3000,other_cost:0}];
    let rows=[];
    const dutyShifts=new Set(['day','night','mobile','special','custom']);
    const number=value=>Number(value||0);
    ${module.slice(start,end)}
    calculate();this.result=rows;
  `,context);
  const site=context.result.find(row=>row.site.id==='a');
  assert.equal(site.revenue,101000);
  assert.ok(Math.abs(site.regularPersonnel-33333.3333)<0.01);
  assert.equal(site.cashPersonnel,5000);
  assert.equal(site.pension,2000);
  assert.ok(Math.abs(site.totalCost-46833.3333)<0.01);
  assert.ok(Math.abs(site.profit-54166.6667)<0.01);
});

test('案場損益使用獨立功能權限並列在薪資與行政',()=>{
  assert.match(app,/siteProfitability: \['案場損益分析','site_profitability_costs'\]/);
  assert.match(app,/\['siteProfitability','案場損益分析'\]/);
  assert.match(app,/state\.view==='siteProfitability'\?await window\.SiteProfitability\.render\(\)/);
  assert.match(html,/data-view="siteProfitability">案場損益分析/);
  assert.match(html,/assets\/site-profitability\.js\?v=1/);
  assert.match(migration,/has_feature_permission\('siteProfitability'\)/);
  assert.match(migration,/for select to authenticated/);
  assert.doesNotMatch(migration,/has_feature_permission\('payroll'\)/);
});

test('損益資料包含必要成本欄位與受保護資料表',()=>{
  for(const field of ['revenue_adjustment','personnel_adjustment','employer_insurance_cost','supplies_cost','equipment_cost','subcontract_cost','transportation_cost','administrative_allocation','other_cost'])assert.match(migration,new RegExp(field));
  assert.match(migration,/unique\(site_id,profit_month\)/);
  assert.match(migration,/enable row level security/);
  for(const label of ['營收','人事攤提','其他成本','總成本','淨利潤','淨利率','成本／調整'])assert.match(module,new RegExp(label));
});
