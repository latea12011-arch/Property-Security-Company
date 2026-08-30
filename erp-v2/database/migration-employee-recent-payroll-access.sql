-- 員工只能查閱當月及前兩個月的已確認／已發薪明細。
-- 具 payroll 權限的 ERP 管理者仍可完整查閱與維護全部歷史資料。
drop policy if exists "staff reads own payroll" on public.payroll_records;

create policy "staff reads own payroll"
on public.payroll_records
for select
to authenticated
using (
  public.has_feature_permission('payroll')
  or (
    employee_id = public.current_employee_id()
    and status in ('confirmed', 'paid')
    and payroll_month >= to_char(
      date_trunc('month', timezone('Asia/Taipei', now())) - interval '2 months',
      'YYYY-MM'
    )
    and payroll_month <= to_char(
      date_trunc('month', timezone('Asia/Taipei', now())),
      'YYYY-MM'
    )
  )
);

comment on policy "staff reads own payroll" on public.payroll_records is
  '員工僅可讀取本人當月及前兩個月已確認或已發薪明細；payroll 管理者可讀取全部歷史資料';
