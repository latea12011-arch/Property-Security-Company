-- 依勞基法第 38 條，以到職週年制自動計算特別休假。
-- 特休日數乘以員工「標準每日工時」，並扣除目前特休期間內已核准的特休時數。

alter table public.employees
  add column if not exists annual_leave_entitlement_hours numeric(8,2) not null default 0 check (annual_leave_entitlement_hours >= 0),
  add column if not exists annual_leave_used_hours numeric(8,2) not null default 0 check (annual_leave_used_hours >= 0),
  add column if not exists annual_leave_period_start date,
  add column if not exists annual_leave_period_end date;

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

  calculated_entitlement := entitlement_days * coalesce(nullif(employee_row.standard_daily_hours,0),8);
  select coalesce(sum(leave_hours),0) into calculated_used
  from public.leave_requests
  where employee_id=target_employee_id and leave_type='annual' and status='approved'
    and start_date>=calculated_start and start_date<calculated_end;

  update public.employees set
    annual_leave_entitlement_hours=calculated_entitlement,
    annual_leave_used_hours=calculated_used,
    annual_leave_hours=greatest(0,calculated_entitlement-calculated_used),
    annual_leave_period_start=calculated_start,
    annual_leave_period_end=calculated_end
  where id=target_employee_id;

  return query select calculated_entitlement,calculated_used,greatest(0,calculated_entitlement-calculated_used),calculated_start,calculated_end;
end; $$;

create or replace function public.refresh_all_annual_leave_balances(as_of date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare employee_record record; refreshed integer := 0;
begin
  for employee_record in select id from public.employees where status='active' loop
    perform public.refresh_employee_annual_leave(employee_record.id,as_of);
    refreshed := refreshed+1;
  end loop;
  return refreshed;
end; $$;

create or replace function public.sync_annual_leave_after_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare employee_to_refresh uuid; current_entitlement numeric; current_used numeric;
begin
  employee_to_refresh := case when tg_op='DELETE' then old.employee_id else new.employee_id end;
  perform public.refresh_employee_annual_leave(employee_to_refresh,current_date);
  if tg_op<>'DELETE' and new.leave_type='annual' and new.status='approved' then
    select annual_leave_entitlement_hours,annual_leave_used_hours into current_entitlement,current_used
    from public.employees where id=new.employee_id;
    if current_used>current_entitlement then raise exception '特休餘額不足，本期可用 % 小時、核准後將使用 % 小時',current_entitlement,current_used; end if;
  end if;
  if tg_op='UPDATE' and old.employee_id is distinct from new.employee_id then
    perform public.refresh_employee_annual_leave(old.employee_id,current_date);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists sync_annual_leave_balance on public.leave_requests;
drop trigger if exists refresh_annual_leave_after_request on public.leave_requests;
create trigger refresh_annual_leave_after_request
after insert or update or delete on public.leave_requests
for each row execute function public.sync_annual_leave_after_request();

create or replace function public.sync_annual_leave_after_employee_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_employee_annual_leave(new.id,current_date);
  return new;
end; $$;
drop trigger if exists refresh_annual_leave_after_employee_change on public.employees;
create trigger refresh_annual_leave_after_employee_change
after insert or update of hire_date,standard_daily_hours on public.employees
for each row execute function public.sync_annual_leave_after_employee_change();

grant execute on function public.refresh_employee_annual_leave(uuid,date) to authenticated;
grant execute on function public.refresh_all_annual_leave_balances(date) to authenticated;
select public.refresh_all_annual_leave_balances(current_date);
