-- 機動人員同一天可在多個案場分別打卡
alter table public.attendance drop constraint if exists attendance_employee_id_work_date_key;
alter table public.attendance drop constraint if exists attendance_employee_id_work_date_site_id_key;
alter table public.attendance add constraint attendance_employee_id_work_date_site_id_key
unique(employee_id,work_date,site_id);
