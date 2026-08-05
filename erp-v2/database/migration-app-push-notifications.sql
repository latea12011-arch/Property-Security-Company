-- 紘嘉 ERP／員工 App 通知中心與 Web Push 訂閱
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('daily_shift','announcement','leave_submitted','leave_reviewed','schedule_published','system')),
  title text not null,
  body text not null,
  target_url text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists app_notifications_event_unique
on public.app_notifications(recipient_user_id,notification_type,entity_type,entity_id)
where entity_id is not null;
create index if not exists app_notifications_recipient_created_idx
on public.app_notifications(recipient_user_id,created_at desc);
create index if not exists app_notifications_pending_push_idx
on public.app_notifications(created_at) where pushed_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

do $$ begin
  alter publication supabase_realtime add table public.app_notifications;
exception when duplicate_object then null;
end $$;

alter table public.app_notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "users read own app notifications" on public.app_notifications;
create policy "users read own app notifications" on public.app_notifications
for select to authenticated using (recipient_user_id=auth.uid());
drop policy if exists "users update own app notifications" on public.app_notifications;
create policy "users update own app notifications" on public.app_notifications
for update to authenticated using (recipient_user_id=auth.uid()) with check (recipient_user_id=auth.uid());

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

grant select,update on public.app_notifications to authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;

create or replace function public.queue_leave_app_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare employee_row record;
begin
  select id,user_id,full_name into employee_row from public.employees where id=new.employee_id;
  if tg_op='INSERT' then
    insert into public.app_notifications(recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id)
    select distinct recipients.user_id,'leave_submitted','新請假申請',employee_row.full_name||'已送出請假申請，請進入 ERP 審核。','./index.html?view=leaves','leave_request',new.id::text
    from (
      select id as user_id from public.profiles where role in ('admin','hr')
      union
      select e.user_id from public.employees e join public.employee_feature_permissions p on p.employee_id=e.id
      where p.feature_key='leaves' and e.user_id is not null and e.status='active'
    ) recipients where recipients.user_id is not null
    on conflict do nothing;
  elsif new.status is distinct from old.status and new.status in ('approved','rejected') and employee_row.user_id is not null then
    insert into public.app_notifications(recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id)
    values(employee_row.user_id,'leave_reviewed',case when new.status='approved' then '請假已核准' else '請假未通過' end,
      new.start_date::text||' 至 '||new.end_date::text||case when new.status='approved' then ' 的請假已核准。' else ' 的請假未通過，請查看審核備註。' end,
      './mobile.html?tab=leaveTab','leave_request',new.id::text||':'||new.status)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists queue_leave_app_notifications on public.leave_requests;
create trigger queue_leave_app_notifications after insert or update of status on public.leave_requests
for each row execute function public.queue_leave_app_notifications();

create or replace function public.queue_announcement_app_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare should_queue boolean := false;
begin
  if tg_op='INSERT' then
    should_queue := new.is_active;
  else
    should_queue := new.is_active and (old.is_active is distinct from new.is_active or old.content is distinct from new.content);
  end if;
  if should_queue and new.publisher is distinct from 'ERP_CALENDAR' then
    insert into public.app_notifications(recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id)
    select e.user_id,'announcement','公司新公告',left(new.content,180),'./mobile.html?tab=homeTab','announcement',new.id::text||':'||extract(epoch from new.published_at)::bigint::text
    from public.employees e where e.user_id is not null and e.status='active'
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists queue_announcement_app_notifications on public.announcements;
create trigger queue_announcement_app_notifications after insert or update on public.announcements
for each row execute function public.queue_announcement_app_notifications();

create or replace function public.queue_schedule_publication_notifications(target_site_id uuid,target_month date)
returns integer language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  if not public.has_feature_permission('schedules') then raise exception '沒有發布班表的權限'; end if;
  insert into public.app_notifications(recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id)
  select distinct e.user_id,'schedule_published','班表已發布',s.name||' '||to_char(target_month,'YYYY 年 MM 月')||'班表已更新，請確認勤務日期與時間。',
    './mobile.html?tab=scheduleTab','schedule_publication',target_site_id::text||':'||to_char(target_month,'YYYY-MM')||':'||e.id::text
  from public.schedules sc join public.employees e on e.id=sc.employee_id join public.sites s on s.id=sc.site_id
  where sc.site_id=target_site_id and date_trunc('month',sc.work_date)=date_trunc('month',target_month) and e.user_id is not null
  on conflict do update set body=excluded.body,created_at=now(),pushed_at=null,read_at=null;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;
grant execute on function public.queue_schedule_publication_notifications(uuid,date) to authenticated;

create or replace function public.queue_daily_shift_reminders(target_date date default (now() at time zone 'Asia/Taipei')::date)
returns integer language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  insert into public.app_notifications(recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id)
  select e.user_id,'daily_shift','今日上班提醒',s.name||'｜'||coalesce(sc.work_time_text,to_char(sc.start_time,'HH24:MI')||'–'||to_char(sc.end_time,'HH24:MI')),
    './mobile.html?tab=homeTab','schedule',sc.id::text||':'||target_date::text
  from public.schedules sc join public.employees e on e.id=sc.employee_id join public.sites s on s.id=sc.site_id
  where sc.work_date=target_date and sc.shift_type in ('day','night','mobile','special','cash','custom') and e.user_id is not null and e.status='active'
  on conflict do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;
revoke all on function public.queue_daily_shift_reminders(date) from public,anon,authenticated;

select pg_notify('pgrst','reload schema');
