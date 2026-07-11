-- 月薪制事假／普通傷病假自動扣款
-- 事假：月薪總額 / 30；病假：法定半薪，扣款為月薪總額 / 30 / 2。

alter table public.employee_payroll_profiles
  add column if not exists personal_leave_day_rate numeric(10,2) not null default 0 check (personal_leave_day_rate >= 0),
  add column if not exists sick_leave_day_rate numeric(10,2) not null default 0 check (sick_leave_day_rate >= 0);

alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check;
alter table public.leave_requests add constraint leave_requests_leave_type_check
  check (leave_type in ('annual','personal','sick','official','marriage','bereavement','maternity','paternity','menstrual','occupational','compensatory','unpaid','typhoon_unpaid','other'));

alter table public.payroll_records
  add column if not exists unpaid_leave_hours numeric(8,2) not null default 0 check (unpaid_leave_hours >= 0),
  add column if not exists unpaid_leave_deduction numeric(12,2) not null default 0 check (unpaid_leave_deduction >= 0);

create or replace function public.calculate_payroll_profile_leave_rates()
returns trigger language plpgsql as $$
begin
  new.personal_leave_day_rate := round(new.basic_salary/30.0,2);
  new.sick_leave_day_rate := round(new.basic_salary/60.0,2);
  new.personal_leave_hour_rate := round(new.basic_salary/30.0/8.0,2);
  new.sick_leave_hour_rate := round(new.basic_salary/30.0/8.0/2.0,2);
  return new;
end; $$;

drop trigger if exists calculate_payroll_profile_leave_rates on public.employee_payroll_profiles;
create trigger calculate_payroll_profile_leave_rates
before insert or update of basic_salary on public.employee_payroll_profiles
for each row execute function public.calculate_payroll_profile_leave_rates();

update public.employee_payroll_profiles set basic_salary=basic_salary;

create or replace function public.calculate_payroll_record()
returns trigger language plpgsql as $$
declare p public.employee_payroll_profiles%rowtype;
begin
  select * into p from public.employee_payroll_profiles where employee_id=new.employee_id;
  if found then
    if new.basic_salary=0 then new.basic_salary=p.basic_salary; end if;
    if new.labor_insurance=0 then new.labor_insurance=p.labor_insurance; end if;
    if new.health_insurance=0 then new.health_insurance=p.health_insurance; end if;
    if new.group_insurance=0 then new.group_insurance=p.group_insurance; end if;
  end if;
  new.personal_leave_deduction := round(new.personal_leave_hours*(new.basic_salary/30.0/8.0),2);
  new.sick_leave_deduction := round(new.sick_leave_hours*(new.basic_salary/30.0/8.0/2.0),2);
  new.unpaid_leave_deduction := round(new.unpaid_leave_hours*(new.basic_salary/30.0/8.0),2);
  new.gross_pay := new.basic_salary+new.overtime_pay+new.allowances;
  new.total_deduction := new.personal_leave_deduction+new.sick_leave_deduction+new.unpaid_leave_deduction+new.labor_insurance+new.health_insurance+new.group_insurance+new.court_deduction+new.advance_deduction+new.other_deduction;
  new.net_pay := new.gross_pay-new.total_deduction;
  return new;
end; $$;
