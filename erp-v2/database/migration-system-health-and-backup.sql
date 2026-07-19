-- ERP 資料庫版本中心與健康檢查（2026-07-19）
create table if not exists public.erp_schema_versions (
  version text primary key,
  description text not null,
  installed_at timestamptz not null default now()
);

alter table public.erp_schema_versions enable row level security;
drop policy if exists "admins read schema versions" on public.erp_schema_versions;
create policy "admins read schema versions" on public.erp_schema_versions
for select to authenticated using (public.current_user_role() = 'admin');
grant select on public.erp_schema_versions to authenticated;

insert into public.erp_schema_versions(version,description)
values ('2026.07.19','備份中心、資料庫版本與健康檢查')
on conflict (version) do update set description=excluded.description;

create or replace function public.get_erp_schema_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_version text;
  issues jsonb := '[]'::jsonb;
begin
  if public.current_user_role() <> 'admin' then
    raise exception '只有系統管理員可以執行健康檢查';
  end if;

  select version into latest_version
  from public.erp_schema_versions
  order by installed_at desc, version desc
  limit 1;

  if to_regclass('public.employees') is null then issues := issues || '"缺少 employees 資料表"'::jsonb; end if;
  if to_regclass('public.schedules') is null then issues := issues || '"缺少 schedules 資料表"'::jsonb; end if;
  if to_regclass('public.attendance_punch_receipts') is null then issues := issues || '"缺少打卡防重複憑證資料表"'::jsonb; end if;
  if to_regclass('public.employee_payroll_profiles') is null then issues := issues || '"缺少薪資設定資料表"'::jsonb; end if;
  if to_regclass('public.payroll_records') is null then issues := issues || '"缺少薪資明細資料表"'::jsonb; end if;
  if to_regclass('public.website_submissions') is null then issues := issues || '"缺少網站通知資料表"'::jsonb; end if;
  if to_regclass('public.inventory_loans') is null then issues := issues || '"缺少設備借用資料表"'::jsonb; end if;
  if to_regclass('public.employee_rules') is null then issues := issues || '"缺少員工守則資料表"'::jsonb; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='employees' and column_name='national_id') then issues := issues || '"員工個資欄位尚未安裝"'::jsonb; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='employees' and column_name='labor_health_insurance_enroll_date') then issues := issues || '"勞健保加保日期欄位尚未安裝"'::jsonb; end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(issues)=0,
    'version', coalesce(latest_version,'未記錄'),
    'issues', issues,
    'checkedAt', now()
  );
end;
$$;

revoke all on function public.get_erp_schema_health() from public;
grant execute on function public.get_erp_schema_health() to authenticated;

notify pgrst, 'reload schema';
