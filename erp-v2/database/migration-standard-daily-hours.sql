-- 每位員工的標準每日工時；保全預設 12 小時，行政職預設 8 小時
alter table public.employees
add column if not exists standard_daily_hours numeric(4,2) not null default 8
check (standard_daily_hours > 0 and standard_daily_hours <= 24);

update public.employees
set standard_daily_hours=case
  when job_title like '%保全%' then 12
  else 8
end;
