-- 特休換薪申請單：到職週年制、滿一年開放，核准後扣除當期特休餘額。
create sequence if not exists public.annual_leave_cashout_no_seq start 1;

create table if not exists public.annual_leave_cashouts (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique default (
    'ALC-' || to_char(current_date,'YYYYMM') || '-' || lpad(nextval('public.annual_leave_cashout_no_seq')::text,6,'0')
  ),
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_no_snapshot text not null default '',
  employee_name_snapshot text not null default '',
  job_title_snapshot text not null default '',
  application_date date not null default current_date,
  leave_period_start date not null,
  leave_period_end date not null,
  entitlement_hours_snapshot numeric(8,2) not null default 0,
  used_hours_snapshot numeric(8,2) not null default 0,
  available_hours_snapshot numeric(8,2) not null default 0,
  requested_hours numeric(8,2) not null check (requested_hours > 0),
  daily_hours_basis numeric(5,2) not null check (daily_hours_basis > 0),
  monthly_salary numeric(12,2) not null check (monthly_salary >= 0),
  hourly_rate numeric(12,4) not null check (hourly_rate >= 0),
  calculated_amount numeric(12,0) not null check (calculated_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid','cancelled')),
  note text,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists annual_leave_cashouts_employee_period_idx
  on public.annual_leave_cashouts(employee_id,leave_period_start,leave_period_end,status);
create index if not exists annual_leave_cashouts_application_date_idx
  on public.annual_leave_cashouts(application_date desc);

create or replace function public.annual_leave_cashout_daily_hours(employee_job_title text, employee_type text)
returns numeric language sql immutable as $$
  select case
    when coalesce(employee_type,'')='internal' then 8::numeric
    when coalesce(employee_job_title,'') in ('總幹事','社區秘書','秘書') then 8::numeric
    when coalesce(employee_job_title,'') like '%保全%' then 10::numeric
    else 8::numeric
  end;
$$;

-- 將已核准／已支付的換薪時數納入年度已使用時數，隔年到職週年自動重新計算。
create or replace function public.refresh_employee_annual_leave(target_employee_id uuid, as_of date default current_date)
returns table (
  entitlement_hours numeric,
  used_hours numeric,
  remaining_hours numeric,
  period_start date,
  period_end date
)
language plpgsql security definer set search_path=public as $$
declare
  employee_row public.employees%rowtype;
  service_age interval;
  service_months integer;
  completed_years integer;
  entitlement_days integer := 0;
  calculated_start date;
  calculated_end date;
  calculated_entitlement numeric := 0;
  approved_leave_hours numeric := 0;
  approved_cashout_hours numeric := 0;
  calculated_used numeric := 0;
begin
  select * into employee_row from public.employees where id=target_employee_id for update;
  if not found then raise exception '找不到員工資料'; end if;

  if employee_row.hire_date is null or employee_row.hire_date > as_of then
    update public.employees set
      annual_leave_entitlement_hours=0, annual_leave_used_hours=0, annual_leave_hours=0,
      annual_leave_period_start=null, annual_leave_period_end=null
    where id=target_employee_id;
    return query select 0::numeric,0::numeric,0::numeric,null::date,null::date;
    return;
  end if;

  service_age := age(as_of,employee_row.hire_date);
  service_months := extract(year from service_age)::integer*12 + extract(month from service_age)::integer;

  if service_months < 6 then
    calculated_start := employee_row.hire_date;
    calculated_end := (employee_row.hire_date + interval '6 months')::date;
  elsif service_months < 12 then
    entitlement_days := 3;
    calculated_start := (employee_row.hire_date + interval '6 months')::date;
    calculated_end := (employee_row.hire_date + interval '1 year')::date;
  else
    completed_years := floor(service_months/12.0)::integer;
    calculated_start := (employee_row.hire_date + make_interval(years=>completed_years))::date;
    calculated_end := (employee_row.hire_date + make_interval(years=>completed_years+1))::date;
    entitlement_days := case
      when completed_years=1 then 7
      when completed_years=2 then 10
      when completed_years between 3 and 4 then 14
      when completed_years between 5 and 9 then 15
      else least(30,15+(completed_years-9))
    end;
  end if;

  calculated_entitlement := entitlement_days * public.annual_leave_cashout_daily_hours(employee_row.job_title,employee_row.employment_type);
  select coalesce(sum(leave_hours),0) into approved_leave_hours
  from public.leave_requests
  where employee_id=target_employee_id and leave_type='annual' and status='approved'
    and start_date>=calculated_start and start_date<calculated_end;

  select coalesce(sum(requested_hours),0) into approved_cashout_hours
  from public.annual_leave_cashouts
  where employee_id=target_employee_id and status in ('approved','paid')
    and application_date>=calculated_start and application_date<calculated_end;

  calculated_used := approved_leave_hours + approved_cashout_hours;
  update public.employees set
    annual_leave_entitlement_hours=calculated_entitlement,
    annual_leave_used_hours=calculated_used,
    annual_leave_hours=greatest(0,calculated_entitlement-calculated_used),
    annual_leave_period_start=calculated_start,
    annual_leave_period_end=calculated_end
  where id=target_employee_id;

  return query select calculated_entitlement,calculated_used,greatest(0,calculated_entitlement-calculated_used),calculated_start,calculated_end;
end; $$;

create or replace function public.prepare_annual_leave_cashout()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  employee_row public.employees%rowtype;
  payroll_row public.employee_payroll_profiles%rowtype;
  other_pending numeric := 0;
  old_approved numeric := 0;
  spendable numeric := 0;
begin
  perform public.refresh_employee_annual_leave(new.employee_id,new.application_date);
  select * into employee_row from public.employees where id=new.employee_id for update;
  if employee_row.hire_date is null then raise exception '此員工尚未填寫入職日期'; end if;
  if employee_row.hire_date + interval '1 year' > new.application_date then raise exception '特休換薪須到職滿一年後才能申請'; end if;
  select * into payroll_row from public.employee_payroll_profiles where employee_id=new.employee_id;
  if not found or coalesce(payroll_row.basic_salary,0)<=0 then raise exception '此員工尚未建立有效月薪，請先完成薪資設定'; end if;

  select coalesce(sum(requested_hours),0) into other_pending
  from public.annual_leave_cashouts
  where employee_id=new.employee_id and status='pending'
    and application_date>=employee_row.annual_leave_period_start
    and application_date<employee_row.annual_leave_period_end
    and id is distinct from new.id;

  if tg_op='UPDATE' and old.status in ('approved','paid') then old_approved := old.requested_hours; end if;
  spendable := greatest(0,employee_row.annual_leave_hours + old_approved - other_pending);
  if new.status in ('pending','approved','paid') and new.requested_hours>spendable then
    raise exception '特休可換薪餘額不足，目前可申請 % 小時',spendable;
  end if;

  new.employee_no_snapshot := employee_row.employee_no;
  new.employee_name_snapshot := employee_row.full_name;
  new.job_title_snapshot := employee_row.job_title;
  new.leave_period_start := employee_row.annual_leave_period_start;
  new.leave_period_end := employee_row.annual_leave_period_end;
  new.entitlement_hours_snapshot := employee_row.annual_leave_entitlement_hours;
  new.used_hours_snapshot := employee_row.annual_leave_used_hours;
  new.available_hours_snapshot := spendable;
  new.daily_hours_basis := public.annual_leave_cashout_daily_hours(employee_row.job_title,employee_row.employment_type);
  new.monthly_salary := payroll_row.basic_salary;
  new.hourly_rate := round(payroll_row.basic_salary/30.0/new.daily_hours_basis,4);
  new.calculated_amount := round(new.requested_hours*new.hourly_rate);
  if tg_op='UPDATE' and new.status is distinct from old.status and new.status in ('approved','rejected','paid','cancelled') then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
  end if;
  return new;
end; $$;

create or replace function public.sync_annual_leave_after_cashout()
returns trigger language plpgsql security definer set search_path=public as $$
declare employee_to_refresh uuid;
begin
  employee_to_refresh := case when tg_op='DELETE' then old.employee_id else new.employee_id end;
  perform public.refresh_employee_annual_leave(employee_to_refresh,current_date);
  if tg_op='UPDATE' and old.employee_id is distinct from new.employee_id then
    perform public.refresh_employee_annual_leave(old.employee_id,current_date);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists prepare_annual_leave_cashout on public.annual_leave_cashouts;
create trigger prepare_annual_leave_cashout before insert or update on public.annual_leave_cashouts
for each row execute function public.prepare_annual_leave_cashout();
drop trigger if exists sync_annual_leave_after_cashout on public.annual_leave_cashouts;
create trigger sync_annual_leave_after_cashout after insert or update or delete on public.annual_leave_cashouts
for each row execute function public.sync_annual_leave_after_cashout();
drop trigger if exists annual_leave_cashouts_updated on public.annual_leave_cashouts;
create trigger annual_leave_cashouts_updated before update on public.annual_leave_cashouts
for each row execute function public.set_updated_at();

create or replace function public.list_annual_leave_cashout_employees()
returns table (
  employee_id uuid, employee_no text, full_name text, job_title text, employment_type text,
  hire_date date, entitlement_hours numeric, used_hours numeric, remaining_hours numeric,
  period_start date, period_end date, daily_hours numeric, monthly_salary numeric, hourly_rate numeric,
  eligible boolean
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.has_feature_permission('annualLeaveCashouts') then raise exception '沒有特休換薪申請單權限'; end if;
  perform public.refresh_all_annual_leave_balances(current_date);
  return query
  select e.id,e.employee_no,e.full_name,e.job_title,e.employment_type,e.hire_date,
    e.annual_leave_entitlement_hours,e.annual_leave_used_hours,e.annual_leave_hours,
    e.annual_leave_period_start,e.annual_leave_period_end,
    public.annual_leave_cashout_daily_hours(e.job_title,e.employment_type),
    coalesce(p.basic_salary,0),
    case when coalesce(p.basic_salary,0)>0 then round(p.basic_salary/30.0/public.annual_leave_cashout_daily_hours(e.job_title,e.employment_type),4) else 0 end,
    (e.hire_date is not null and e.hire_date+interval '1 year'<=current_date and coalesce(p.basic_salary,0)>0)
  from public.employees e
  left join public.employee_payroll_profiles p on p.employee_id=e.id
  where e.status='active'
  order by e.employee_no,e.full_name;
end; $$;

alter table public.annual_leave_cashouts enable row level security;
drop policy if exists "cashout staff manage annual leave cashouts" on public.annual_leave_cashouts;
create policy "cashout staff manage annual leave cashouts" on public.annual_leave_cashouts
for all to authenticated
using (public.has_feature_permission('annualLeaveCashouts'))
with check (public.has_feature_permission('annualLeaveCashouts'));

revoke all on function public.list_annual_leave_cashout_employees() from public,anon;
grant execute on function public.list_annual_leave_cashout_employees() to authenticated;
grant execute on function public.annual_leave_cashout_daily_hours(text,text) to authenticated;
grant usage,select on sequence public.annual_leave_cashout_no_seq to authenticated;
grant select,insert,update,delete on public.annual_leave_cashouts to authenticated;
notify pgrst,'reload schema';
select public.refresh_all_annual_leave_balances(current_date);
select 'annual leave cashouts installed' as status;
