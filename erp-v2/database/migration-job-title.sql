-- 將人事職稱與系統權限分離。
alter table public.employees add column if not exists job_title text not null default '保全員';
comment on column public.employees.job_title is '人事職稱；role 欄位僅作系統權限控制';
