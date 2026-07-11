-- 紘嘉物業 ERP v2 / Supabase PostgreSQL schema
-- 在 Supabase Dashboard > SQL Editor 執行本檔。

create extension if not exists pgcrypto;

create type public.app_role as enum ('guard','site_manager','hr','admin');
create type public.record_status as enum ('active','inactive');
create type public.leave_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'guard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  employee_no text not null unique,
  full_name text not null,
  phone text,
  role public.app_role not null default 'guard',
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text not null,
  contact_name text,
  contact_phone text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  is_manager boolean not null default false,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  unique(employee_id,site_id,start_date)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  work_date date not null,
  shift_type text not null check (shift_type in ('day','night','custom')),
  start_time time not null,
  end_time time not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,work_date,start_time)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  clock_in_lat numeric(9,6),
  clock_in_lng numeric(9,6),
  clock_out_lat numeric(9,6),
  clock_out_lng numeric(9,6),
  status text not null default 'normal' check (status in ('normal','late','missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,work_date)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type text not null check (leave_type in ('annual','personal','sick','official')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status public.leave_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger employees_updated before update on public.employees for each row execute function public.set_updated_at();
create trigger sites_updated before update on public.sites for each row execute function public.set_updated_at();
create trigger schedules_updated before update on public.schedules for each row execute function public.set_updated_at();
create trigger attendance_updated before update on public.attendance for each row execute function public.set_updated_at();
create trigger leaves_updated before update on public.leave_requests for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,full_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
  update public.employees
  set user_id = new.id
  where user_id is null
    and lower(employee_no) = split_part(lower(new.email), '@', 1)
    and lower(new.email) like '%@employee.hongjia.local';
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.link_employee_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    select id into new.user_id
    from auth.users
    where lower(email) = lower(new.employee_no) || '@employee.hongjia.local'
    limit 1;
  end if;
  return new;
end;
$$;
create trigger auto_link_employee_user before insert or update of employee_no on public.employees for each row execute function public.link_employee_auth_user();

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile self read" on public.profiles for select using (id=auth.uid() or public.current_user_role() in ('hr','admin'));
create policy "admin manages profiles" on public.profiles for all using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

create policy "staff reads permitted employees" on public.employees for select to authenticated using (id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "hr manages employees" on public.employees for all using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));

create policy "authenticated reads sites" on public.sites for select to authenticated using (true);
create policy "managers manage sites" on public.sites for all using (public.current_user_role() in ('site_manager','admin')) with check (public.current_user_role() in ('site_manager','admin'));

create policy "authenticated reads assignments" on public.site_assignments for select to authenticated using (true);
create policy "managers manage assignments" on public.site_assignments for all using (public.current_user_role() in ('hr','site_manager','admin')) with check (public.current_user_role() in ('hr','site_manager','admin'));

create policy "staff reads own schedules" on public.schedules for select using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "managers manage schedules" on public.schedules for all using (public.current_user_role() in ('hr','site_manager','admin')) with check (public.current_user_role() in ('hr','site_manager','admin'));

create policy "staff reads own attendance" on public.attendance for select using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "staff creates own attendance" on public.attendance for insert with check (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "staff updates own attendance" on public.attendance for update using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin')) with check (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "managers delete attendance" on public.attendance for delete using (public.current_user_role() in ('hr','site_manager','admin'));

create policy "staff reads own leave" on public.leave_requests for select using (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','site_manager','admin'));
create policy "staff creates own leave" on public.leave_requests for insert with check (employee_id=public.current_employee_id() or public.current_user_role() in ('hr','admin'));
create policy "managers review leave" on public.leave_requests for update using (public.current_user_role() in ('hr','site_manager','admin')) with check (public.current_user_role() in ('hr','site_manager','admin'));
create policy "hr deletes leave" on public.leave_requests for delete using (public.current_user_role() in ('hr','admin'));

create policy "admin reads audit logs" on public.audit_logs for select using (public.current_user_role()='admin');

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.employees,public.sites,public.site_assignments,public.schedules,public.attendance,public.leave_requests to authenticated;
grant select on public.audit_logs to authenticated;

-- 建立第一位使用者後，在 SQL Editor 將該使用者提升為管理員：
-- update public.profiles set role='admin', full_name='系統管理員' where id='貼上 Auth 使用者 UUID';
