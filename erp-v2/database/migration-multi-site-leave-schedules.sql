-- 允許機動人員在多個案場同步標示休假，但實際執勤仍不可重複時段。
alter table public.schedules
  drop constraint if exists schedules_employee_id_work_date_start_time_key;

drop index if exists public.schedules_employee_duty_time_unique;

create unique index schedules_employee_duty_time_unique
  on public.schedules (employee_id, work_date, start_time)
  where shift_type in ('day', 'night', 'mobile', 'special', 'cash', 'custom');

comment on index public.schedules_employee_duty_time_unique
is '實際執勤不得有相同開始時間；休、特休、事假及病假可同步標示於多個案場';
