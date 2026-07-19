-- 永久刪除員工時保留已完成領現的現金班憑證，但解除員工主檔關聯。
alter table public.schedules
  add column if not exists employee_no_snapshot text,
  add column if not exists employee_name_snapshot text;

update public.schedules s
set employee_no_snapshot = coalesce(s.employee_no_snapshot, e.employee_no),
    employee_name_snapshot = coalesce(s.employee_name_snapshot, e.full_name)
from public.employees e
where s.employee_id = e.id
  and s.shift_type = 'cash'
  and s.cash_payment_status = 'paid';

alter table public.schedules alter column employee_id drop not null;

create or replace function public.snapshot_schedule_employee()
returns trigger language plpgsql set search_path=public as $$
declare employee_record record;
begin
  if new.employee_id is not null
     and (tg_op = 'INSERT'
          or new.employee_id is distinct from old.employee_id
          or new.employee_no_snapshot is null
          or new.employee_name_snapshot is null) then
    select employee_no, full_name into employee_record
    from public.employees where id = new.employee_id;
    new.employee_no_snapshot := coalesce(new.employee_no_snapshot, employee_record.employee_no);
    new.employee_name_snapshot := coalesce(new.employee_name_snapshot, employee_record.full_name);
  end if;
  return new;
end;
$$;

drop trigger if exists schedules_snapshot_employee on public.schedules;
create trigger schedules_snapshot_employee
before insert or update of employee_id on public.schedules
for each row execute function public.snapshot_schedule_employee();

comment on column public.schedules.employee_no_snapshot is '排班建立時的員工工號；員工永久刪除後供歷史憑證顯示';
comment on column public.schedules.employee_name_snapshot is '排班建立時的員工姓名；員工永久刪除後供歷史憑證顯示';

select 'paid cash schedule preservation installed' as status;
