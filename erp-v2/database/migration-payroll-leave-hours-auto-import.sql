-- 薪資單自動匯入已核准請假時數。
-- 事假為全額扣薪；病假與生理假為半薪扣款；無薪假與天然災害不支薪為全額扣薪。

create or replace function public.calculate_approved_leave_hours(
  target_employee_id uuid,
  target_payroll_month text
)
returns table (
  personal_leave_hours numeric(8,2),
  sick_leave_hours numeric(8,2),
  unpaid_leave_hours numeric(8,2),
  matched_requests integer
)
language sql
stable
security definer
set search_path = public
as $$
  with month_bounds as (
    select
      to_date(left(target_payroll_month, 7) || '-01', 'YYYY-MM-DD') as month_start,
      (to_date(left(target_payroll_month, 7) || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date as month_end
  ), approved_leaves as (
    select
      request.leave_type,
      request.leave_hours::numeric as leave_hours,
      request.start_date,
      request.end_date,
      greatest(request.start_date, bounds.month_start) as overlap_start,
      least(request.end_date, bounds.month_end) as overlap_end
    from public.leave_requests request
    cross join month_bounds bounds
    where request.employee_id = target_employee_id
      and request.status = 'approved'
      and request.leave_type in ('personal', 'sick', 'menstrual', 'unpaid', 'typhoon_unpaid')
      and request.start_date <= bounds.month_end
      and request.end_date >= bounds.month_start
  ), allocated as (
    select
      leave_type,
      leave_hours *
        ((overlap_end - overlap_start + 1)::numeric /
         greatest((end_date - start_date + 1), 1)::numeric) as month_hours
    from approved_leaves
  )
  select
    coalesce(round(sum(month_hours) filter (where leave_type = 'personal'), 2), 0)::numeric(8,2),
    coalesce(round(sum(month_hours) filter (where leave_type in ('sick', 'menstrual')), 2), 0)::numeric(8,2),
    coalesce(round(sum(month_hours) filter (where leave_type in ('unpaid', 'typhoon_unpaid')), 2), 0)::numeric(8,2),
    count(*)::integer
  from allocated;
$$;

revoke all on function public.calculate_approved_leave_hours(uuid, text) from public, anon, authenticated;

create or replace function public.get_approved_leave_hours_for_payroll(
  target_employee_id uuid,
  target_payroll_month text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  summary record;
begin
  if auth.uid() is null or not public.has_feature_permission('payroll') then
    raise exception '沒有薪資明細功能權限';
  end if;
  if target_payroll_month is null or target_payroll_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '薪資月份格式錯誤';
  end if;

  select * into summary
  from public.calculate_approved_leave_hours(target_employee_id, target_payroll_month);

  return jsonb_build_object(
    'personal_leave_hours', summary.personal_leave_hours,
    'sick_leave_hours', summary.sick_leave_hours,
    'unpaid_leave_hours', summary.unpaid_leave_hours,
    'matched_requests', summary.matched_requests
  );
end;
$$;

revoke all on function public.get_approved_leave_hours_for_payroll(uuid, text) from public, anon;
grant execute on function public.get_approved_leave_hours_for_payroll(uuid, text) to authenticated;

create or replace function public.import_approved_leave_hours_into_payroll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  summary record;
begin
  select * into summary
  from public.calculate_approved_leave_hours(new.employee_id, new.payroll_month);

  new.personal_leave_hours := summary.personal_leave_hours;
  new.sick_leave_hours := summary.sick_leave_hours;
  new.unpaid_leave_hours := summary.unpaid_leave_hours;
  return new;
end;
$$;

drop trigger if exists aa_payroll_import_approved_leave_hours on public.payroll_records;
create trigger aa_payroll_import_approved_leave_hours
before insert or update of employee_id, payroll_month on public.payroll_records
for each row execute function public.import_approved_leave_hours_into_payroll();

create or replace function public.refresh_draft_payroll_leave_hours(
  target_employee_id uuid,
  target_payroll_month text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  summary record;
begin
  select * into summary
  from public.calculate_approved_leave_hours(target_employee_id, target_payroll_month);

  update public.payroll_records
  set personal_leave_hours = summary.personal_leave_hours,
      sick_leave_hours = summary.sick_leave_hours,
      unpaid_leave_hours = summary.unpaid_leave_hours
  where employee_id = target_employee_id
    and payroll_month = target_payroll_month
    and status = 'draft';
end;
$$;

revoke all on function public.refresh_draft_payroll_leave_hours(uuid, text) from public, anon, authenticated;

create or replace function public.sync_approved_leave_to_draft_payroll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  month_value date;
begin
  if tg_op <> 'INSERT' then
    for month_value in
      select generate_series(
        date_trunc('month', old.start_date)::date,
        date_trunc('month', old.end_date)::date,
        interval '1 month'
      )::date
    loop
      perform public.refresh_draft_payroll_leave_hours(old.employee_id, to_char(month_value, 'YYYY-MM'));
    end loop;
  end if;

  if tg_op <> 'DELETE' then
    for month_value in
      select generate_series(
        date_trunc('month', new.start_date)::date,
        date_trunc('month', new.end_date)::date,
        interval '1 month'
      )::date
    loop
      perform public.refresh_draft_payroll_leave_hours(new.employee_id, to_char(month_value, 'YYYY-MM'));
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_approved_leave_to_draft_payroll on public.leave_requests;
create trigger sync_approved_leave_to_draft_payroll
after insert or update of employee_id, leave_type, start_date, end_date, leave_hours, status or delete
on public.leave_requests
for each row execute function public.sync_approved_leave_to_draft_payroll();

-- 安裝後立即補齊現有草稿薪資單。
do $$
declare
  payroll record;
begin
  for payroll in
    select distinct employee_id, payroll_month
    from public.payroll_records
    where status = 'draft'
  loop
    perform public.refresh_draft_payroll_leave_hours(payroll.employee_id, payroll.payroll_month);
  end loop;
end;
$$;

select 'payroll approved leave auto import installed' as result;
