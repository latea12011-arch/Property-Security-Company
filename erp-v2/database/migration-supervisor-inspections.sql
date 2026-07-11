-- 督導巡查與缺失改善追蹤
create table if not exists public.supervisor_inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_date date not null default current_date,
  inspection_time time not null default localtime,
  site_id uuid not null references public.sites(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  inspection_type text not null default 'routine' check (inspection_type in ('routine','night','special','complaint')),
  overall_result text not null default 'pass' check (overall_result in ('pass','improvement_required','critical')),
  staff_discipline text not null default 'good' check (staff_discipline in ('good','needs_improvement','not_applicable')),
  post_records text not null default 'good' check (post_records in ('good','needs_improvement','not_applicable')),
  equipment_status text not null default 'good' check (equipment_status in ('good','needs_improvement','not_applicable')),
  environment_safety text not null default 'good' check (environment_safety in ('good','needs_improvement','not_applicable')),
  findings text,
  corrective_action text,
  due_date date,
  follow_up_status text not null default 'none' check (follow_up_status in ('none','pending','in_progress','verified')),
  resolved_at date,
  site_contact text,
  photo_url text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or due_date >= inspection_date),
  check (follow_up_status <> 'verified' or resolved_at is not null),
  check (overall_result = 'pass' or follow_up_status <> 'none')
);

create index if not exists supervisor_inspections_site_date_idx on public.supervisor_inspections(site_id,inspection_date desc);
create index if not exists supervisor_inspections_follow_up_idx on public.supervisor_inspections(follow_up_status,due_date);

drop trigger if exists supervisor_inspections_updated on public.supervisor_inspections;
create trigger supervisor_inspections_updated before update on public.supervisor_inspections for each row execute function public.set_updated_at();

alter table public.supervisor_inspections enable row level security;
drop policy if exists "authorized staff read inspections" on public.supervisor_inspections;
create policy "authorized staff read inspections" on public.supervisor_inspections for select to authenticated
  using (public.current_user_role() in ('site_manager','hr','admin') or employee_id=public.current_employee_id());
drop policy if exists "managers create inspections" on public.supervisor_inspections;
create policy "managers create inspections" on public.supervisor_inspections for insert to authenticated
  with check (public.current_user_role() in ('site_manager','hr','admin'));
drop policy if exists "managers update inspections" on public.supervisor_inspections;
create policy "managers update inspections" on public.supervisor_inspections for update to authenticated
  using (public.current_user_role() in ('site_manager','hr','admin')) with check (public.current_user_role() in ('site_manager','hr','admin'));
drop policy if exists "admin deletes inspections" on public.supervisor_inspections;
create policy "admin deletes inspections" on public.supervisor_inspections for delete to authenticated
  using (public.current_user_role()='admin');

grant select,insert,update,delete on public.supervisor_inspections to authenticated;
