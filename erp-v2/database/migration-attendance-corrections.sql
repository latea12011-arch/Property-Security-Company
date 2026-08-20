-- ERP 補打卡：保留原始值、補登值、原因與操作人，並以 RPC 原子更新打卡資料。
create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  work_date date not null,
  old_clock_in timestamptz,
  old_clock_out timestamptz,
  corrected_clock_in timestamptz,
  corrected_clock_out timestamptz,
  reason text not null check (length(trim(reason)) between 1 and 500),
  corrected_by uuid references auth.users(id) on delete set null default auth.uid(),
  corrected_at timestamptz not null default now()
);

create index if not exists attendance_corrections_attendance_idx on public.attendance_corrections(attendance_id,corrected_at desc);
create index if not exists attendance_corrections_employee_date_idx on public.attendance_corrections(employee_id,work_date desc);
alter table public.attendance_corrections enable row level security;

drop policy if exists "attendance managers read corrections" on public.attendance_corrections;
create policy "attendance managers read corrections" on public.attendance_corrections for select to authenticated
using (public.current_user_role() in ('admin','hr','site_manager') or public.has_feature_permission('attendance'));

create or replace function public.save_attendance_correction(
  target_employee_id uuid,
  target_site_id uuid,
  target_work_date date,
  target_clock_in timestamptz,
  target_clock_out timestamptz,
  correction_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  current_row public.attendance%rowtype;
  saved_id uuid;
begin
  if not (public.current_user_role() in ('admin','hr','site_manager') or public.has_feature_permission('attendance')) then
    raise exception '您沒有補打卡權限';
  end if;
  if target_employee_id is null or target_site_id is null or target_work_date is null then raise exception '員工、案場與日期不可空白'; end if;
  if target_clock_in is null and target_clock_out is null then raise exception '至少需要一個打卡時間'; end if;
  if length(trim(coalesce(correction_reason,'')))=0 then raise exception '請填寫補打卡原因'; end if;
  if target_clock_in is not null and target_clock_out is not null and target_clock_out<=target_clock_in then raise exception '下班時間必須晚於上班時間'; end if;
  if target_clock_in is not null and (target_clock_in at time zone 'Asia/Taipei')::date<>target_work_date then raise exception '上班時間日期與出勤日期不一致'; end if;
  if target_clock_out is not null and (target_clock_out at time zone 'Asia/Taipei')::date not in (target_work_date,target_work_date+1) then raise exception '下班時間僅可為出勤當日或隔日'; end if;

  select * into current_row from public.attendance
  where employee_id=target_employee_id and site_id=target_site_id and work_date=target_work_date
  order by created_at limit 1 for update;

  if found then
    update public.attendance set
      clock_in=target_clock_in,
      clock_out=target_clock_out,
      status=case when target_clock_in is not null and target_clock_out is not null then 'normal' else 'missing' end
    where id=current_row.id returning id into saved_id;
  else
    insert into public.attendance(employee_id,site_id,work_date,clock_in,clock_out,status)
    values(target_employee_id,target_site_id,target_work_date,target_clock_in,target_clock_out,
      case when target_clock_in is not null and target_clock_out is not null then 'normal' else 'missing' end)
    returning id into saved_id;
  end if;

  insert into public.attendance_corrections(attendance_id,employee_id,site_id,work_date,old_clock_in,old_clock_out,corrected_clock_in,corrected_clock_out,reason)
  values(saved_id,target_employee_id,target_site_id,target_work_date,current_row.clock_in,current_row.clock_out,target_clock_in,target_clock_out,trim(correction_reason));
  return saved_id;
end;
$$;

revoke all on function public.save_attendance_correction(uuid,uuid,date,timestamptz,timestamptz,text) from public;
grant execute on function public.save_attendance_correction(uuid,uuid,date,timestamptz,timestamptz,text) to authenticated;
