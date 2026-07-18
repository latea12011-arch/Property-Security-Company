-- 員工管理直接維護薪資設定

alter table public.employee_payroll_profiles
  add column if not exists pension_contribution numeric(12,2) not null default 0
    check (pension_contribution >= 0);

comment on column public.employee_payroll_profiles.pension_contribution
  is '勞退雇主提繳金額；員工管理依月薪 6% 提供試算並可手動調整';

grant select,insert,update on public.employee_payroll_profiles to authenticated;

select 'employee payroll inline migration installed' as result;
