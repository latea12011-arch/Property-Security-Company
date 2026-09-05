-- 排班勤務哨別：班別（日／夜）與哨別分開保存。
alter table public.schedules
  add column if not exists duty_post text;

alter table public.schedules
  drop constraint if exists schedules_duty_post_check;

alter table public.schedules
  add constraint schedules_duty_post_check check (
    duty_post is null or duty_post in (
      'main','control','lane','patrol','secondary','lobby','gate','parking',
      'reception','mobile_support','other','chief_manager','secretary','cleaner'
    )
  );

comment on column public.schedules.duty_post is
  '勤務哨別：總幹事、秘書、清潔人員、主哨、中控、車道、巡邏哨、副哨、大廳哨、門禁哨、停車場哨、收發哨、機動支援或其他';

-- 同步更新案場整月安全覆蓋函式，讓匯入與畫面儲存都能保留勤務哨別。
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
    select 1 from jsonb_to_recordset(coalesce(schedule_records, '[]'::jsonb)) as r(
      employee_id uuid, site_id uuid, work_date date, shift_type text, duty_post text,
      start_time time, end_time time, work_time_text text, cash_amount numeric,
      cash_payment_status text
    )
    where r.site_id is distinct from target_site_id
       or r.work_date < month_start or r.work_date > month_end
  ) then raise exception '班表內含其他案場或月份的資料'; end if;

  delete from public.schedules
  where site_id = target_site_id and work_date between month_start and month_end
    and not (shift_type = 'cash' and cash_payment_status = 'paid');

  insert into public.schedules (
    employee_id, site_id, work_date, shift_type, duty_post, start_time, end_time,
    work_time_text, cash_amount, cash_payment_status
  )
  select r.employee_id, r.site_id, r.work_date, r.shift_type, nullif(r.duty_post,''),
    r.start_time, r.end_time, nullif(r.work_time_text,''), coalesce(r.cash_amount,0),
    case when r.shift_type='cash' then 'pending' else 'none' end
  from jsonb_to_recordset(coalesce(schedule_records, '[]'::jsonb)) as r(
    employee_id uuid, site_id uuid, work_date date, shift_type text, duty_post text,
    start_time time, end_time time, work_time_text text, cash_amount numeric,
    cash_payment_status text
  )
  where not exists (
    select 1 from public.schedules paid
    where paid.employee_id=r.employee_id and paid.work_date=r.work_date
      and paid.shift_type='cash' and paid.cash_payment_status='paid'
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.replace_site_month_schedules(uuid,date,jsonb) to authenticated;
