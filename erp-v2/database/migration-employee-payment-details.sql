-- 員工薪資發放方式與銀行帳戶

alter table public.employees
  add column if not exists salary_payment_method text not null default 'cash',
  add column if not exists bank_code text,
  add column if not exists bank_account_no text;

alter table public.employees
  drop constraint if exists employees_salary_payment_method_check;

alter table public.employees
  add constraint employees_salary_payment_method_check
  check (salary_payment_method in ('bank_transfer','cash'));

comment on column public.employees.salary_payment_method is '薪資發放方式：bank_transfer 銀行匯款、cash 領現';
comment on column public.employees.bank_code is '薪資匯款銀行代碼';
comment on column public.employees.bank_account_no is '薪資匯款帳戶';

grant select,insert,update on public.employees to authenticated;

select 'employee payment details migration installed' as result;
