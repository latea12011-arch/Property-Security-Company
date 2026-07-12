-- ERP 總覽行事曆：臨時／固定事件與提醒
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'temporary' check (event_type in ('temporary','fixed')),
  event_date date not null,
  event_time time not null default '09:00',
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  end_date date,
  reminder_minutes integer not null default 0 check (reminder_minutes>=0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date>=event_date),
  check ((event_type='temporary' and recurrence='none') or event_type='fixed')
);
create index if not exists calendar_events_date_idx on public.calendar_events(event_date,end_date);
drop trigger if exists calendar_events_updated on public.calendar_events;
create trigger calendar_events_updated before update on public.calendar_events for each row execute function public.set_updated_at();
alter table public.calendar_events enable row level security;
drop policy if exists "authenticated reads calendar" on public.calendar_events;
create policy "authenticated reads calendar" on public.calendar_events for select to authenticated using (true);
drop policy if exists "authenticated manages calendar" on public.calendar_events;
create policy "authenticated manages calendar" on public.calendar_events for all to authenticated
using (true) with check (true);
grant select,insert,update,delete on public.calendar_events to authenticated;
