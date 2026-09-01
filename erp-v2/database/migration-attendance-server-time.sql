begin;

create or replace function public.attendance_server_time()
returns timestamptz
language sql
stable
security definer
set search_path=public
as $$
  select clock_timestamp();
$$;

revoke all on function public.attendance_server_time() from public;
grant execute on function public.attendance_server_time() to authenticated;

comment on function public.attendance_server_time() is
  '提供員工端打卡使用的伺服器校準時間，避免手機系統時間誤差造成有效打卡被拒絕。';

commit;
