-- 員工 App 通知僅保留每位員工最近 10 則。

create or replace function public.prune_my_app_notifications(keep_count integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
  safe_keep_count integer := greatest(1, least(coalesce(keep_count, 10), 10));
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;

  delete from public.app_notifications
  where id in (
    select id
    from public.app_notifications
    where recipient_user_id = auth.uid()
    order by created_at desc, id desc
    offset safe_keep_count
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_my_app_notifications(integer) from public, anon;
grant execute on function public.prune_my_app_notifications(integer) to authenticated;

create or replace function public.retain_recent_employee_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.employees where user_id = new.recipient_user_id
  ) then
    delete from public.app_notifications
    where id in (
      select id
      from public.app_notifications
      where recipient_user_id = new.recipient_user_id
      order by created_at desc, id desc
      offset 10
    );
  end if;
  return new;
end;
$$;

drop trigger if exists retain_recent_employee_app_notifications on public.app_notifications;
create trigger retain_recent_employee_app_notifications
after insert on public.app_notifications
for each row execute function public.retain_recent_employee_app_notifications();

with ranked as (
  select n.id,
         row_number() over (
           partition by n.recipient_user_id
           order by n.created_at desc, n.id desc
         ) as row_no
  from public.app_notifications n
  join public.employees e on e.user_id = n.recipient_user_id
)
delete from public.app_notifications n
using ranked r
where n.id = r.id and r.row_no > 10;

select pg_notify('pgrst', 'reload schema');
