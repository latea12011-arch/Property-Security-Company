-- 員工薪資銀行新增分行，薪資明細同步保留當期分行快照。
alter table public.employees
  add column if not exists bank_branch text;

alter table public.payroll_records
  add column if not exists bank_branch text;

comment on column public.employees.bank_branch is '薪資匯款銀行分行';
comment on column public.payroll_records.bank_branch is '該期薪資實際匯款分行快照';

notify pgrst,'reload schema';
select 'employee bank branch installed' as status;
