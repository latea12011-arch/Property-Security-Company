-- 高併發／斷線重送安全打卡：唯一請求編號、資料庫原子交易、伺服器端排班與 GPS 驗證。

create table if not exists public.attendance_punch_receipts (
  request_id uuid primary key,
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  punch_type text not null check (punch_type in ('in','out')),
  punched_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists attendance_employee_site_date_idx on public.attendance(employee_id,site_id,work_date);
create index if not exists schedules_employee_site_date_idx on public.schedules(employee_id,site_id,work_date);
create index if not exists punch_receipts_employee_received_idx on public.attendance_punch_receipts(employee_id,received_at desc);
alter table public.attendance_punch_receipts enable row level security;

create or replace function public.submit_attendance_punch(
  punch_request_id uuid,
  punch_site_id uuid,
  punch_work_date date,
  punch_type text,
  punch_time timestamptz,
  punch_lat numeric,
  punch_lng numeric,
  punch_accuracy numeric default 0
)
returns table(attendance_id uuid, accepted_at timestamptz, result text)
language plpgsql security definer set search_path=public as $$
declare
  employee_uuid uuid;
  attendance_row public.attendance%rowtype;
  existing_receipt public.attendance_punch_receipts%rowtype;
  site_row public.sites%rowtype;
  distance_m numeric;
  allowed_m numeric;
begin
  if punch_type not in ('in','out') then raise exception '無效的打卡類型'; end if;
  employee_uuid := public.current_employee_id();
  if employee_uuid is null then raise exception '登入帳號尚未綁定員工'; end if;

  select * into existing_receipt from public.attendance_punch_receipts where request_id=punch_request_id;
  if found then
    return query select existing_receipt.attendance_id,existing_receipt.punched_at,'duplicate'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(employee_uuid::text||punch_site_id::text||punch_work_date::text,0));

  if not exists(select 1 from public.schedules where employee_id=employee_uuid and site_id=punch_site_id and work_date=punch_work_date and shift_type in ('day','night','mobile','special','cash','custom')) then
    raise exception '當日沒有此案場的有效勤務';
  end if;
  select * into site_row from public.sites where id=punch_site_id and status='active';
  if not found then raise exception '案場不存在或已停用'; end if;
  if site_row.latitude is null or site_row.longitude is null then raise exception '案場尚未設定 GPS'; end if;
  if punch_lat is null or punch_lng is null then raise exception '缺少 GPS 定位'; end if;

  distance_m := 6371000*2*asin(least(1,sqrt(
    power(sin(radians((punch_lat-site_row.latitude)/2)),2)+
    cos(radians(site_row.latitude))*cos(radians(punch_lat))*power(sin(radians((punch_lng-site_row.longitude)/2)),2)
  )));
  allowed_m := coalesce(site_row.punch_radius_m,200)+greatest(coalesce(punch_accuracy,0),0);
  if distance_m>allowed_m then raise exception '不在案場打卡範圍內（距離約 % 公尺）',round(distance_m); end if;

  select * into attendance_row from public.attendance
  where employee_id=employee_uuid and site_id=punch_site_id and work_date=punch_work_date for update;

  if punch_type='in' then
    if not found then
      insert into public.attendance(employee_id,site_id,work_date,clock_in,clock_in_lat,clock_in_lng,status)
      values(employee_uuid,punch_site_id,punch_work_date,punch_time,punch_lat,punch_lng,'normal') returning * into attendance_row;
    elsif attendance_row.clock_in is null then
      update public.attendance set clock_in=punch_time,clock_in_lat=punch_lat,clock_in_lng=punch_lng
      where id=attendance_row.id returning * into attendance_row;
    end if;
  else
    if not found or attendance_row.clock_in is null then raise exception '上班打卡尚未送達，系統稍後會依序重試'; end if;
    if attendance_row.clock_out is null then
      update public.attendance set clock_out=punch_time,clock_out_lat=punch_lat,clock_out_lng=punch_lng
      where id=attendance_row.id returning * into attendance_row;
    end if;
  end if;

  insert into public.attendance_punch_receipts(request_id,attendance_id,employee_id,punch_type,punched_at)
  values(punch_request_id,attendance_row.id,employee_uuid,punch_type,punch_time);
  return query select attendance_row.id,punch_time,'accepted'::text;
end; $$;

grant execute on function public.submit_attendance_punch(uuid,uuid,date,text,timestamptz,numeric,numeric,numeric) to authenticated;
