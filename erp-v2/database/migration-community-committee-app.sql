-- 社區管委會 APP：社區隔離授權與總幹事／秘書工作日誌
create table if not exists public.community_committee_access (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  member_name text not null,
  email text not null,
  committee_role text not null default '委員' check (committee_role in ('主任委員','副主任委員','監察委員','財務委員','委員','其他')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id,email)
);

create table if not exists public.community_work_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  log_date date not null default current_date,
  category text not null default 'general' check (category in ('general','administration','finance','repair','vendor','resident','meeting','incident','other')),
  title text not null,
  content text not null,
  follow_up_status text not null default 'completed' check (follow_up_status in ('pending','processing','completed')),
  attachment_path text,
  visible_to_committee boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_committee_access_email_idx on public.community_committee_access(lower(email)) where is_active;
create index if not exists community_work_logs_site_date_idx on public.community_work_logs(site_id,log_date desc);

create or replace function public.current_committee_has_site(target_site uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.community_committee_access a
    where a.site_id=target_site and a.is_active
      and lower(a.email)=lower(coalesce(auth.jwt()->>'email','')))
$$;
grant execute on function public.current_committee_has_site(uuid) to authenticated;

alter table public.community_committee_access enable row level security;
alter table public.community_work_logs enable row level security;

drop policy if exists "committee reads own access" on public.community_committee_access;
create policy "committee reads own access" on public.community_committee_access for select to authenticated
using (lower(email)=lower(coalesce(auth.jwt()->>'email','')) or public.current_user_role()='admin');
drop policy if exists "admin manages committee access" on public.community_committee_access;
create policy "admin manages committee access" on public.community_committee_access for all to authenticated
using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

drop policy if exists "staff manages own work logs" on public.community_work_logs;
create policy "staff manages own work logs" on public.community_work_logs for all to authenticated
using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'))
with check (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
drop policy if exists "committee reads visible work logs" on public.community_work_logs;
create policy "committee reads visible work logs" on public.community_work_logs for select to authenticated
using (visible_to_committee and public.current_committee_has_site(site_id));

drop policy if exists "committee reads assigned site" on public.sites;
create policy "committee reads assigned site" on public.sites for select to authenticated using (public.current_committee_has_site(id));
drop policy if exists "committee reads assigned schedules" on public.schedules;
create policy "committee reads assigned schedules" on public.schedules for select to authenticated using (public.current_committee_has_site(site_id));
drop policy if exists "committee reads assigned employees" on public.employees;
create policy "committee reads assigned employees" on public.employees for select to authenticated using (
  exists(select 1 from public.site_assignments a where a.employee_id=employees.id and public.current_committee_has_site(a.site_id))
  or exists(select 1 from public.schedules s where s.employee_id=employees.id and public.current_committee_has_site(s.site_id))
);

grant select,insert,update,delete on public.community_committee_access,public.community_work_logs to authenticated;

drop trigger if exists community_committee_access_updated on public.community_committee_access;
create trigger community_committee_access_updated before update on public.community_committee_access for each row execute function public.set_updated_at();
drop trigger if exists community_work_logs_updated on public.community_work_logs;
create trigger community_work_logs_updated before update on public.community_work_logs for each row execute function public.set_updated_at();

select 'community committee app installed' as status;
