-- 薪資發放帳戶與匯款手續費
-- 手續費為公司負擔，不計入員工薪資扣款。

alter table public.payroll_records
  add column if not exists salary_payment_method text not null default 'cash',
  add column if not exists bank_code text,
  add column if not exists bank_account_no text,
  add column if not exists transfer_fee numeric(10,2) not null default 0
    check (transfer_fee >= 0);

alter table public.payroll_records
  drop constraint if exists payroll_records_salary_payment_method_check;

alter table public.payroll_records
  add constraint payroll_records_salary_payment_method_check
  check (salary_payment_method in ('bank_transfer','cash'));

comment on column public.payroll_records.salary_payment_method is '該期薪資實際發放方式';
comment on column public.payroll_records.bank_code is '該期薪資實際匯款銀行代碼';
comment on column public.payroll_records.bank_account_no is '該期薪資實際匯款帳戶快照';
comment on column public.payroll_records.transfer_fee is '公司負擔的匯款手續費，不計入員工扣款';

grant select,insert,update on public.payroll_records to authenticated;

select 'payroll transfer fees migration installed' as result;
