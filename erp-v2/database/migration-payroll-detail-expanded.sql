-- 薪資明細擴充：整合現行公司薪資表常用應發、獎金、稅額及福利扣款欄位。
alter table public.payroll_records
  add column if not exists holiday_overtime_pay numeric(12,2) not null default 0,
  add column if not exists substitute_shift_allowance numeric(12,2) not null default 0,
  add column if not exists attendance_bonus numeric(12,2) not null default 0,
  add column if not exists incentive_bonus numeric(12,2) not null default 0,
  add column if not exists annual_bonus numeric(12,2) not null default 0,
  add column if not exists withholding_tax numeric(12,2) not null default 0,
  add column if not exists supplementary_health_premium numeric(12,2) not null default 0,
  add column if not exists welfare_deduction numeric(12,2) not null default 0;

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
  if new.salary_payment_method <> 'bank_transfer' or new.bank_fee_mode <> 'other_bank_employee' then new.transfer_fee := 0; end if;
  new.personal_leave_deduction := round(new.personal_leave_hours * (new.basic_salary / 30.0 / 8.0), 2);
  new.sick_leave_deduction := round(new.sick_leave_hours * (new.basic_salary / 30.0 / 8.0 / 2.0), 2);
  new.unpaid_leave_deduction := round(new.unpaid_leave_hours * (new.basic_salary / 30.0 / 8.0), 2);
  new.gross_pay := new.basic_salary + new.overtime_pay + new.holiday_overtime_pay
    + new.substitute_shift_allowance + new.attendance_bonus + new.incentive_bonus
    + new.annual_bonus + new.allowances;
  new.total_deduction := new.personal_leave_deduction + new.sick_leave_deduction
    + new.unpaid_leave_deduction + new.labor_insurance + new.health_insurance
    + new.group_insurance + new.withholding_tax + new.supplementary_health_premium
    + new.court_deduction + new.advance_deduction + new.welfare_deduction
    + new.other_deduction + new.transfer_fee;
  new.net_pay := new.gross_pay - new.total_deduction;
  return new;
end; $$;

update public.payroll_records set updated_at = updated_at where status = 'draft';
select 'payroll detail expanded' as result;
