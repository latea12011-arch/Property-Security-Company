-- 舊版第一批功能移植：人事欄位、案場 GPS、公告。
alter table public.employees add column if not exists emergency_contact_name text;
alter table public.employees add column if not exists emergency_contact_phone text;
alter table public.employees add column if not exists hire_date date;
alter table public.employees add column if not exists employment_type text not null default 'full_time' check (employment_type in ('full_time','mobile'));

alter table public.sites add column if not exists latitude numeric(9,6);
alter table public.sites add column if not exists longitude numeric(9,6);
alter table public.sites add column if not exists punch_radius_m integer not null default 200 check (punch_radius_m between 10 and 5000);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  publisher text not null,
  content text not null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "staff reads announcements" on public.announcements;
create policy "staff reads announcements" on public.announcements for select to authenticated using (is_active or public.current_user_role() in ('hr','admin'));
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements for all using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));
grant select,insert,update,delete on public.announcements to authenticated;
