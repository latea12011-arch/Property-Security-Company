-- 每位後台人員的個別功能權限
create table if not exists public.employee_feature_permissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  feature_key text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(employee_id,feature_key)
);

alter table public.employee_feature_permissions enable row level security;
drop policy if exists "staff reads own feature permissions" on public.employee_feature_permissions;
create policy "staff reads own feature permissions" on public.employee_feature_permissions
for select to authenticated using (employee_id=public.current_employee_id() or public.current_user_role()='admin');
drop policy if exists "admin manages feature permissions" on public.employee_feature_permissions;
create policy "admin manages feature permissions" on public.employee_feature_permissions
for all to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');
grant select,insert,update,delete on public.employee_feature_permissions to authenticated;

create or replace function public.has_feature_permission(requested_feature text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_role()='admin' or exists (
    select 1 from public.employee_feature_permissions
    where employee_id=public.current_employee_id() and feature_key=requested_feature
  );
$$;
grant execute on function public.has_feature_permission(text) to authenticated;

create or replace function public.sync_employee_profile_role()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.user_id is not null then
    update public.profiles set full_name=new.full_name,role=new.role where id=new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists sync_employee_profile_role on public.employees;
create trigger sync_employee_profile_role after insert or update of user_id,role,full_name on public.employees
for each row execute function public.sync_employee_profile_role();
update public.profiles p set full_name=e.full_name,role=e.role from public.employees e where e.user_id=p.id;
