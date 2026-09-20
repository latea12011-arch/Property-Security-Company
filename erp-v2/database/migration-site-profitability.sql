-- 案場損益分析：每月案場成本補登與獨立權限。
create table if not exists public.site_profitability_costs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  profit_month text not null check (profit_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  revenue_adjustment numeric(14,2) not null default 0,
  personnel_adjustment numeric(14,2) not null default 0,
  employer_insurance_cost numeric(14,2) not null default 0 check (employer_insurance_cost >= 0),
  supplies_cost numeric(14,2) not null default 0 check (supplies_cost >= 0),
  equipment_cost numeric(14,2) not null default 0 check (equipment_cost >= 0),
  subcontract_cost numeric(14,2) not null default 0 check (subcontract_cost >= 0),
  transportation_cost numeric(14,2) not null default 0 check (transportation_cost >= 0),
  administrative_allocation numeric(14,2) not null default 0 check (administrative_allocation >= 0),
  other_cost numeric(14,2) not null default 0 check (other_cost >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id,profit_month)
);

create index if not exists site_profitability_costs_month_idx
  on public.site_profitability_costs(profit_month,site_id);

drop trigger if exists site_profitability_costs_updated on public.site_profitability_costs;
create trigger site_profitability_costs_updated before update on public.site_profitability_costs
for each row execute function public.set_updated_at();

alter table public.site_profitability_costs enable row level security;
drop policy if exists "profitability staff manage site costs" on public.site_profitability_costs;
create policy "profitability staff manage site costs" on public.site_profitability_costs
for all to authenticated
using (public.has_feature_permission('siteProfitability'))
with check (public.has_feature_permission('siteProfitability'));

-- 損益頁需要讀取自動計算來源，但不能因此取得薪資或請款功能的寫入權限。
drop policy if exists "profitability staff reads payroll records" on public.payroll_records;
create policy "profitability staff reads payroll records" on public.payroll_records
for select to authenticated using (public.has_feature_permission('siteProfitability'));

drop policy if exists "profitability staff reads payroll profiles" on public.employee_payroll_profiles;
create policy "profitability staff reads payroll profiles" on public.employee_payroll_profiles
for select to authenticated using (public.has_feature_permission('siteProfitability'));

drop policy if exists "profitability staff reads schedules" on public.schedules;
create policy "profitability staff reads schedules" on public.schedules
for select to authenticated using (public.has_feature_permission('siteProfitability'));

drop policy if exists "profitability staff reads billing claims" on public.community_billing_claims;
create policy "profitability staff reads billing claims" on public.community_billing_claims
for select to authenticated using (public.has_feature_permission('siteProfitability'));

drop policy if exists "profitability staff reads sites" on public.sites;
create policy "profitability staff reads sites" on public.sites
for select to authenticated using (public.has_feature_permission('siteProfitability'));

grant select,insert,update,delete on public.site_profitability_costs to authenticated;
notify pgrst,'reload schema';
select 'site profitability installed' as status;
