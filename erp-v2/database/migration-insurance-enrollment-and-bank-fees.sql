-- 勞健保加保日期與薪資匯款手續費（員工負擔）

alter table public.employees
  add column if not exists labor_health_insurance_enroll_date date,
  add column if not exists bank_fee_mode text not null default 'company_bank';

alter table public.employees drop constraint if exists employees_bank_fee_mode_check;
alter table public.employees add constraint employees_bank_fee_mode_check
  check (bank_fee_mode in ('company_bank', 'other_bank_employee'));

alter table public.payroll_records
  add column if not exists bank_fee_mode text not null default 'company_bank';

alter table public.payroll_records drop constraint if exists payroll_records_bank_fee_mode_check;
alter table public.payroll_records add constraint payroll_records_bank_fee_mode_check
  check (bank_fee_mode in ('company_bank', 'other_bank_employee'));

comment on column public.employees.labor_health_insurance_enroll_date is '勞工保險及全民健康保險加保日期';
comment on column public.employees.bank_fee_mode is 'company_bank=本公司銀行（0元）；other_bank_employee=非本公司銀行（員工負擔手續費）';
comment on column public.payroll_records.bank_fee_mode is 'company_bank=本公司銀行（0元）；other_bank_employee=非本公司銀行（員工負擔手續費）';
comment on column public.payroll_records.transfer_fee is '非本公司銀行時由員工負擔的匯款手續費，列入薪資扣款';

-- 保留既有草稿中已填入的手續費；其餘資料預設為本公司銀行。
update public.payroll_records
set bank_fee_mode = 'other_bank_employee'
where status = 'draft'
  and salary_payment_method = 'bank_transfer'
  and coalesce(transfer_fee, 0) > 0;

create or replace function public.calculate_payroll_record()
returns trigger language plpgsql as $$
declare p public.employee_payroll_profiles%rowtype;
begin
  select * into p from public.employee_payroll_profiles where employee_id = new.employee_id;
  if found then
    if new.basic_salary = 0 then new.basic_salary := p.basic_salary; end if;
    if new.labor_insurance = 0 then new.labor_insurance := p.labor_insurance; end if;
    if new.health_insurance = 0 then new.health_insurance := p.health_insurance; end if;
    if new.group_insurance = 0 then new.group_insurance := p.group_insurance; end if;
  end if;

  if new.salary_payment_method <> 'bank_transfer'
     or new.bank_fee_mode <> 'other_bank_employee' then
    new.transfer_fee := 0;
  end if;

  new.personal_leave_deduction := round(new.personal_leave_hours * (new.basic_salary / 30.0 / 8.0), 2);
  new.sick_leave_deduction := round(new.sick_leave_hours * (new.basic_salary / 30.0 / 8.0 / 2.0), 2);
  new.unpaid_leave_deduction := round(new.unpaid_leave_hours * (new.basic_salary / 30.0 / 8.0), 2);
  new.gross_pay := new.basic_salary + new.overtime_pay + new.allowances;
  new.total_deduction := new.personal_leave_deduction + new.sick_leave_deduction
    + new.unpaid_leave_deduction + new.labor_insurance + new.health_insurance
    + new.group_insurance + new.court_deduction + new.advance_deduction
    + new.other_deduction + new.transfer_fee;
  new.net_pay := new.gross_pay - new.total_deduction;
  return new;
end; $$;

-- 讓草稿立即套用新的扣款邏輯，不改動已確認或已付款的歷史薪資。
update public.payroll_records
set transfer_fee = transfer_fee
where status = 'draft';

select 'insurance enrollment and employee bank fee migration installed' as result;
