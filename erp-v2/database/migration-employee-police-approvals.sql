-- 保全人員警局核備：員工管理與獨立核備區共用同一筆資料。
create table if not exists public.employee_police_approvals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  status text not null default 'not_submitted'
    check (status in ('not_submitted','submitted','supplement_required','approved','rejected')),
  police_station text,
  submitted_date date,
  document_no text,
  approval_date date,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_police_approvals_status_idx
  on public.employee_police_approvals(status, submitted_date desc);

alter table public.employee_police_approvals enable row level security;
drop policy if exists "hr manages employee police approvals" on public.employee_police_approvals;
create policy "hr manages employee police approvals"
on public.employee_police_approvals for all to authenticated
using (
  public.has_feature_permission('employees')
  or public.has_feature_permission('policeApprovals')
)
with check (
  public.has_feature_permission('employees')
  or public.has_feature_permission('policeApprovals')
);

grant select,insert,update,delete on public.employee_police_approvals to authenticated;

-- 單獨授權「警局核備」的人員需能讀取員工工號、姓名與職稱，才能建立清冊。
drop policy if exists "staff reads permitted employees" on public.employees;
create policy "staff reads permitted employees" on public.employees for select to authenticated
using (
  id=public.current_employee_id()
  or public.has_any_feature(array[
    'employees','policeApprovals','schedules','attendance','leaves',
    'payrollProfiles','advances','payroll','terminations',
    'inventoryTransactions','inventoryLoans'
  ])
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'drop trigger if exists employee_police_approvals_updated on public.employee_police_approvals';
    execute 'create trigger employee_police_approvals_updated before update on public.employee_police_approvals for each row execute function public.set_updated_at()';
  end if;
  if to_regprocedure('public.write_audit_log()') is not null then
    execute 'drop trigger if exists audit_changes on public.employee_police_approvals';
    execute 'create trigger audit_changes after insert or update or delete on public.employee_police_approvals for each row execute function public.write_audit_log()';
  end if;
end $$;
