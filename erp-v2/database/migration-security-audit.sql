-- 正式權限控管與操作稽核紀錄
alter table public.audit_logs add column if not exists actor_name text;

create or replace function public.has_any_feature(requested_features text[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_role()='admin' or exists (
    select 1 from public.employee_feature_permissions
    where employee_id=public.current_employee_id() and feature_key=any(requested_features)
  );
$$;
grant execute on function public.has_any_feature(text[]) to authenticated;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_data jsonb; new_data jsonb; target_id text; who text;
begin
  old_data:=case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_data:=case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  target_id:=coalesce(new_data->>'id',old_data->>'id');
  select coalesce(p.full_name,u.email,auth.uid()::text) into who
  from auth.users u left join public.profiles p on p.id=u.id where u.id=auth.uid();
  insert into public.audit_logs(actor_id,actor_name,action,table_name,record_id,details)
  values(auth.uid(),who,tg_op,tg_table_name,target_id,jsonb_build_object('old',old_data,'new',new_data));
  return null;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','employees','sites','site_assignments','schedules','attendance','leave_requests','announcements','bullying_complaints','employee_payroll_profiles','salary_advances','payroll_records','termination_certificates','inventory_items','inventory_transactions','employee_feature_permissions']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists audit_changes on public.%I',t);
      execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.write_audit_log()',t);
    end if;
  end loop;
end $$;

-- 員工與基本資料
drop policy if exists "staff reads permitted employees" on public.employees;
create policy "staff reads permitted employees" on public.employees for select to authenticated
using (id=public.current_employee_id() or public.has_any_feature(array['employees','schedules','attendance','leaves','payrollProfiles','advances','payroll','terminations','inventoryTransactions']));
drop policy if exists "hr manages employees" on public.employees;
create policy "hr manages employees" on public.employees for all to authenticated
using (public.has_feature_permission('employees')) with check (public.has_feature_permission('employees'));

drop policy if exists "managers manage sites" on public.sites;
create policy "managers manage sites" on public.sites for all to authenticated
using (public.has_feature_permission('sites')) with check (public.has_feature_permission('sites'));
drop policy if exists "authenticated reads assignments" on public.site_assignments;
create policy "authenticated reads assignments" on public.site_assignments for select to authenticated
using (employee_id=public.current_employee_id() or public.has_any_feature(array['employees','sites','schedules']));
drop policy if exists "managers manage assignments" on public.site_assignments;
create policy "managers manage assignments" on public.site_assignments for all to authenticated
using (public.has_any_feature(array['employees','sites','schedules'])) with check (public.has_any_feature(array['employees','sites','schedules']));

-- 班表、打卡、請假
drop policy if exists "staff reads own schedules" on public.schedules;
create policy "staff reads own schedules" on public.schedules for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('schedules'));
drop policy if exists "managers manage schedules" on public.schedules;
create policy "managers manage schedules" on public.schedules for all to authenticated using (public.has_feature_permission('schedules')) with check (public.has_feature_permission('schedules'));
drop policy if exists "staff reads own attendance" on public.attendance;
create policy "staff reads own attendance" on public.attendance for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('attendance'));
drop policy if exists "staff creates own attendance" on public.attendance;
create policy "staff creates own attendance" on public.attendance for insert to authenticated with check (employee_id=public.current_employee_id() or public.has_feature_permission('attendance'));
drop policy if exists "staff updates own attendance" on public.attendance;
create policy "staff updates own attendance" on public.attendance for update to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('attendance')) with check (employee_id=public.current_employee_id() or public.has_feature_permission('attendance'));
drop policy if exists "managers delete attendance" on public.attendance;
create policy "managers delete attendance" on public.attendance for delete to authenticated using (public.has_feature_permission('attendance'));
drop policy if exists "staff reads own leave" on public.leave_requests;
create policy "staff reads own leave" on public.leave_requests for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('leaves'));
drop policy if exists "staff creates own leave" on public.leave_requests;
create policy "staff creates own leave" on public.leave_requests for insert to authenticated with check (employee_id=public.current_employee_id() or public.has_feature_permission('leaves'));
drop policy if exists "managers review leave" on public.leave_requests;
create policy "managers review leave" on public.leave_requests for update to authenticated using (public.has_feature_permission('leaves')) with check (public.has_feature_permission('leaves'));
drop policy if exists "hr deletes leave" on public.leave_requests;
create policy "hr deletes leave" on public.leave_requests for delete to authenticated using (public.has_feature_permission('leaves'));

-- 公告與申訴
drop policy if exists "staff reads announcements" on public.announcements;
create policy "staff reads announcements" on public.announcements for select to authenticated using (is_active or public.has_feature_permission('announcements'));
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements for all to authenticated using (public.has_feature_permission('announcements')) with check (public.has_feature_permission('announcements'));
drop policy if exists "employees read own bullying complaints" on public.bullying_complaints;
create policy "employees read own bullying complaints" on public.bullying_complaints for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('complaints'));
drop policy if exists "hr handles bullying complaints" on public.bullying_complaints;
create policy "hr handles bullying complaints" on public.bullying_complaints for update to authenticated using (public.has_feature_permission('complaints')) with check (public.has_feature_permission('complaints'));

-- 薪資與行政
drop policy if exists "hr manages payroll profiles" on public.employee_payroll_profiles;
create policy "hr manages payroll profiles" on public.employee_payroll_profiles for all to authenticated using (public.has_feature_permission('payrollProfiles')) with check (public.has_feature_permission('payrollProfiles'));
drop policy if exists "staff reads own payroll" on public.payroll_records;
create policy "staff reads own payroll" on public.payroll_records for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('payroll'));
drop policy if exists "hr manages payroll" on public.payroll_records;
create policy "hr manages payroll" on public.payroll_records for all to authenticated using (public.has_feature_permission('payroll')) with check (public.has_feature_permission('payroll'));
drop policy if exists "staff reads own advances" on public.salary_advances;
create policy "staff reads own advances" on public.salary_advances for select to authenticated using (employee_id=public.current_employee_id() or public.has_feature_permission('advances'));
drop policy if exists "hr manages advances" on public.salary_advances;
create policy "hr manages advances" on public.salary_advances for all to authenticated using (public.has_feature_permission('advances')) with check (public.has_feature_permission('advances'));
drop policy if exists "hr manages termination certificates" on public.termination_certificates;
create policy "hr manages termination certificates" on public.termination_certificates for all to authenticated using (public.has_feature_permission('terminations')) with check (public.has_feature_permission('terminations'));

-- 庫存
drop policy if exists "staff reads inventory items" on public.inventory_items;
create policy "staff reads inventory items" on public.inventory_items for select to authenticated using (public.has_any_feature(array['inventoryItems','inventoryTransactions']));
drop policy if exists "hr manages inventory items" on public.inventory_items;
create policy "hr manages inventory items" on public.inventory_items for all to authenticated using (public.has_feature_permission('inventoryItems')) with check (public.has_feature_permission('inventoryItems'));
drop policy if exists "managers read inventory transactions" on public.inventory_transactions;
create policy "managers read inventory transactions" on public.inventory_transactions for select to authenticated using (public.has_feature_permission('inventoryTransactions'));
drop policy if exists "managers manage inventory transactions" on public.inventory_transactions;
create policy "managers manage inventory transactions" on public.inventory_transactions for all to authenticated using (public.has_feature_permission('inventoryTransactions')) with check (public.has_feature_permission('inventoryTransactions'));

drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using (public.current_user_role()='admin');
grant select on public.audit_logs to authenticated;
