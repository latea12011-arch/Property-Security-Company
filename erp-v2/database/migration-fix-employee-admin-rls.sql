-- 修復員工新增時的 RLS 權限。
-- 請先把下方 email 改成實際登入 ERP 後台的管理員信箱，再整份執行。

insert into public.profiles (id, full_name, role)
select id, '系統管理員', 'admin'::public.app_role
from auth.users
where lower(email) = lower('latea0517@gmail.com')
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'admin'::public.app_role;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists "hr manages employees" on public.employees;
create policy "hr manages employees"
on public.employees
for all
to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

grant select, insert, update, delete on public.employees to authenticated;

-- 執行結果應顯示管理員帳號及 admin。
select u.id, u.email, p.full_name, p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('latea0517@gmail.com');
