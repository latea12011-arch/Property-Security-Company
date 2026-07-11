-- 既有專案執行一次：使用工號自動綁定 Auth 帳號，不再手動複製 UID。

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,full_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;

  update public.employees
  set user_id = new.id
  where user_id is null
    and lower(employee_no) = split_part(lower(new.email), '@', 1)
    and lower(new.email) like '%@employee.hongjia.local';
  return new;
end;
$$;

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

drop trigger if exists auto_link_employee_user on public.employees;
create trigger auto_link_employee_user
before insert or update of employee_no on public.employees
for each row execute function public.link_employee_auth_user();

-- 立即補綁已經存在的員工與 Auth 帳號。
update public.employees e
set user_id = u.id
from auth.users u
where e.user_id is null
  and lower(u.email) = lower(e.employee_no) || '@employee.hongjia.local';

select employee_no, full_name, user_id
from public.employees
order by employee_no;
