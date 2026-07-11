-- 薪資與行政：薪資設定、借支、保險與扣款、薪資單、離職證明

create table if not exists public.employee_payroll_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  basic_salary numeric(12,2) not null default 0 check (basic_salary >= 0),
  personal_leave_hour_rate numeric(10,2) not null default 0 check (personal_leave_hour_rate >= 0),
  sick_leave_hour_rate numeric(10,2) not null default 0 check (sick_leave_hour_rate >= 0),
  labor_insurance numeric(10,2) not null default 0 check (labor_insurance >= 0),
  health_insurance numeric(10,2) not null default 0 check (health_insurance >= 0),
  group_insurance numeric(10,2) not null default 0 check (group_insurance >= 0),
  effective_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  advance_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  repayment_month text,
  status text not null default 'pending' check (status in ('pending','approved','deducted','rejected','cancelled')),
  note text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  payroll_month text not null check (payroll_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  basic_salary numeric(12,2) not null default 0,
  overtime_pay numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  personal_leave_hours numeric(8,2) not null default 0,
  sick_leave_hours numeric(8,2) not null default 0,
  personal_leave_deduction numeric(12,2) not null default 0,
  sick_leave_deduction numeric(12,2) not null default 0,
  labor_insurance numeric(12,2) not null default 0,
  health_insurance numeric(12,2) not null default 0,
  group_insurance numeric(12,2) not null default 0,
  court_deduction numeric(12,2) not null default 0,
  advance_deduction numeric(12,2) not null default 0,
  other_deduction numeric(12,2) not null default 0,
  other_deduction_note text,
  gross_pay numeric(12,2) not null default 0,
  total_deduction numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','confirmed','paid')),
  paid_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,payroll_month)
);

create table if not exists public.termination_certificates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  separation_date date not null,
  separation_reason text not null,
  job_description text,
  issue_date date not null default current_date,
  certificate_no text unique,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
    new.personal_leave_deduction=round(new.personal_leave_hours*p.personal_leave_hour_rate,2);
    new.sick_leave_deduction=round(new.sick_leave_hours*p.sick_leave_hour_rate,2);
  end if;
  new.gross_pay=new.basic_salary+new.overtime_pay+new.allowances;
  new.total_deduction=new.personal_leave_deduction+new.sick_leave_deduction+new.labor_insurance+new.health_insurance+new.group_insurance+new.court_deduction+new.advance_deduction+new.other_deduction;
  new.net_pay=new.gross_pay-new.total_deduction;
  return new;
end; $$;

drop trigger if exists calculate_payroll_record on public.payroll_records;
create trigger calculate_payroll_record before insert or update on public.payroll_records
for each row execute function public.calculate_payroll_record();

do $$ begin
  create trigger payroll_profiles_updated before update on public.employee_payroll_profiles for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin create trigger salary_advances_updated before update on public.salary_advances for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
do $$ begin create trigger payroll_records_updated before update on public.payroll_records for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
do $$ begin create trigger termination_certificates_updated before update on public.termination_certificates for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;

alter table public.employee_payroll_profiles enable row level security;
alter table public.salary_advances enable row level security;
alter table public.payroll_records enable row level security;
alter table public.termination_certificates enable row level security;

drop policy if exists "hr manages payroll profiles" on public.employee_payroll_profiles;
drop policy if exists "staff reads own payroll" on public.payroll_records;
drop policy if exists "hr manages payroll" on public.payroll_records;
drop policy if exists "staff reads own advances" on public.salary_advances;
drop policy if exists "hr manages advances" on public.salary_advances;
drop policy if exists "hr manages termination certificates" on public.termination_certificates;
create policy "hr manages payroll profiles" on public.employee_payroll_profiles for all to authenticated using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));
create policy "staff reads own payroll" on public.payroll_records for select to authenticated using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','admin'));
create policy "hr manages payroll" on public.payroll_records for all to authenticated using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));
create policy "staff reads own advances" on public.salary_advances for select to authenticated using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','admin'));
create policy "hr manages advances" on public.salary_advances for all to authenticated using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));
create policy "hr manages termination certificates" on public.termination_certificates for all to authenticated using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));

grant select,insert,update,delete on public.employee_payroll_profiles,public.salary_advances,public.payroll_records,public.termination_certificates to authenticated;
