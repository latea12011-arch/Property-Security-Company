-- 案場導向整月排班：以單一交易安全更新班表，並保留已完成領現的現金班。
create or replace function public.replace_site_month_schedules(
  target_site_id uuid,
  target_month date,
  schedule_records jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  inserted_count integer := 0;
begin
  if public.current_user_role() not in ('hr','site_manager','admin') then
    raise exception '您沒有更新班表的權限';
  end if;

  if jsonb_typeof(coalesce(schedule_records, '[]'::jsonb)) <> 'array' then
    raise exception '班表資料格式錯誤';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(schedule_records, '[]'::jsonb)) as r(
      employee_id uuid, site_id uuid, work_date date, shift_type text,
      start_time time, end_time time, work_time_text text,
      cash_amount numeric, cash_payment_status text
    )
    where r.site_id is distinct from target_site_id
       or r.work_date < month_start
       or r.work_date > month_end
  ) then
    raise exception '班表內含其他案場或月份的資料';
  end if;

  delete from public.schedules
  where site_id = target_site_id
    and work_date between month_start and month_end
    and not (shift_type = 'cash' and cash_payment_status = 'paid');

  insert into public.schedules (
    employee_id, site_id, work_date, shift_type, start_time, end_time,
    work_time_text, cash_amount, cash_payment_status
  )
  select
    r.employee_id, r.site_id, r.work_date, r.shift_type, r.start_time, r.end_time,
    nullif(r.work_time_text, ''), coalesce(r.cash_amount, 0),
    case when r.shift_type = 'cash' then 'pending' else 'none' end
  from jsonb_to_recordset(coalesce(schedule_records, '[]'::jsonb)) as r(
    employee_id uuid, site_id uuid, work_date date, shift_type text,
    start_time time, end_time time, work_time_text text,
    cash_amount numeric, cash_payment_status text
  )
  where not exists (
    select 1 from public.schedules paid
    where paid.employee_id = r.employee_id
      and paid.work_date = r.work_date
      and paid.shift_type = 'cash'
      and paid.cash_payment_status = 'paid'
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.replace_site_month_schedules(uuid,date,jsonb) to authenticated;

comment on function public.replace_site_month_schedules(uuid,date,jsonb)
is '以案場及月份原子更新整月班表，已領現班次不刪除、不覆蓋';
