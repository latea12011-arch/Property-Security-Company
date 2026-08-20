-- 補打卡申請／審核制：申請時不修改正式打卡，核准後才套用。
alter table public.attendance_corrections alter column attendance_id drop not null;
alter table public.attendance_corrections
  add column if not exists approval_status text not null default 'approved',
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;
update public.attendance_corrections set approval_status='approved',requested_by=coalesce(requested_by,corrected_by),requested_at=coalesce(requested_at,corrected_at),reviewed_by=coalesce(reviewed_by,corrected_by),reviewed_at=coalesce(reviewed_at,corrected_at) where requested_by is null or reviewed_at is null;
alter table public.attendance_corrections drop constraint if exists attendance_corrections_approval_status_check;
alter table public.attendance_corrections add constraint attendance_corrections_approval_status_check check (approval_status in ('pending','approved','rejected'));
create index if not exists attendance_corrections_approval_idx on public.attendance_corrections(approval_status,requested_at desc);

create or replace function public.save_attendance_correction(target_employee_id uuid,target_site_id uuid,target_work_date date,target_clock_in timestamptz,target_clock_out timestamptz,correction_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare current_row public.attendance%rowtype; request_id uuid;
begin
  if not (public.current_user_role() in ('admin','hr','site_manager') or public.has_feature_permission('attendance')) then raise exception '您沒有補打卡申請權限'; end if;
  if target_employee_id is null or target_site_id is null or target_work_date is null then raise exception '員工、案場與日期不可空白'; end if;
  if target_clock_in is null and target_clock_out is null then raise exception '至少需要一個打卡時間'; end if;
  if length(trim(coalesce(correction_reason,'')))=0 then raise exception '請填寫補打卡原因'; end if;
  if target_clock_in is not null and target_clock_out is not null and target_clock_out<=target_clock_in then raise exception '下班時間必須晚於上班時間'; end if;
  if target_clock_in is not null and (target_clock_in at time zone 'Asia/Taipei')::date<>target_work_date then raise exception '上班時間日期與出勤日期不一致'; end if;
  if target_clock_out is not null and (target_clock_out at time zone 'Asia/Taipei')::date not in (target_work_date,target_work_date+1) then raise exception '下班時間僅可為出勤當日或隔日'; end if;
  if exists(select 1 from public.attendance_corrections where employee_id=target_employee_id and site_id=target_site_id and work_date=target_work_date and approval_status='pending') then raise exception '此員工當日已有待審核的補打卡申請'; end if;
  select * into current_row from public.attendance where employee_id=target_employee_id and site_id=target_site_id and work_date=target_work_date order by created_at limit 1;
  insert into public.attendance_corrections(attendance_id,employee_id,site_id,work_date,old_clock_in,old_clock_out,corrected_clock_in,corrected_clock_out,reason,approval_status,requested_by,requested_at,corrected_by)
  values(current_row.id,target_employee_id,target_site_id,target_work_date,current_row.clock_in,current_row.clock_out,target_clock_in,target_clock_out,trim(correction_reason),'pending',auth.uid(),now(),null) returning id into request_id;
  return request_id;
end; $$;

create or replace function public.review_attendance_correction(target_request_id uuid,decision text,review_comment text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare request_row public.attendance_corrections%rowtype; saved_id uuid;
begin
  if public.current_user_role() not in ('admin','hr') then raise exception '僅系統管理員或人事可審核補打卡'; end if;
  if decision not in ('approved','rejected') then raise exception '審核結果不正確'; end if;
  select * into request_row from public.attendance_corrections where id=target_request_id for update;
  if not found then raise exception '找不到補打卡申請'; end if;
  if request_row.approval_status<>'pending' then raise exception '此申請已完成審核'; end if;
  if request_row.requested_by=auth.uid() then raise exception '申請人不可審核自己的補打卡申請'; end if;
  if decision='approved' then
    if request_row.attendance_id is not null then update public.attendance set clock_in=request_row.corrected_clock_in,clock_out=request_row.corrected_clock_out,status=case when request_row.corrected_clock_in is not null and request_row.corrected_clock_out is not null then 'normal' else 'missing' end where id=request_row.attendance_id returning id into saved_id;
    else insert into public.attendance(employee_id,site_id,work_date,clock_in,clock_out,status) values(request_row.employee_id,request_row.site_id,request_row.work_date,request_row.corrected_clock_in,request_row.corrected_clock_out,case when request_row.corrected_clock_in is not null and request_row.corrected_clock_out is not null then 'normal' else 'missing' end) returning id into saved_id; end if;
  end if;
  update public.attendance_corrections set attendance_id=coalesce(saved_id,attendance_id),approval_status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(coalesce(review_comment,'')),''),corrected_by=case when decision='approved' then auth.uid() else null end,corrected_at=case when decision='approved' then now() else corrected_at end where id=target_request_id;
  return coalesce(saved_id,request_row.attendance_id);
end; $$;
revoke all on function public.review_attendance_correction(uuid,text,text) from public;
grant execute on function public.review_attendance_correction(uuid,text,text) to authenticated;
select 'attendance correction approval installed' as result;
