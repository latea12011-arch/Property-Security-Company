-- 員工管理直接維護薪資設定

alter table public.employee_payroll_profiles
  add column if not exists pension_contribution numeric(12,2) not null default 0
    check (pension_contribution >= 0);

comment on column public.employee_payroll_profiles.pension_contribution
  is '勞退雇主提繳金額；員工管理依月薪 6% 提供試算並可手動調整';

grant select,insert,update on public.employee_payroll_profiles to authenticated;

drop policy if exists "hr manages payroll profiles" on public.employee_payroll_profiles;
create policy "hr manages payroll profiles"
on public.employee_payroll_profiles for all to authenticated
using (
  public.has_feature_permission('payrollProfiles')
  or public.has_feature_permission('employees')
)
with check (
  public.has_feature_permission('payrollProfiles')
  or public.has_feature_permission('employees')
);

select 'employee payroll inline migration installed' as result;
