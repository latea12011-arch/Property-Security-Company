-- 員工出生年月日、勞基法第 84-1 條核備及借支申請單欄位。
alter table public.employees add column if not exists birth_date date;
alter table public.employees add column if not exists labor_84_1_status text not null default 'not_submitted';
alter table public.employees add column if not exists labor_84_1_authority text;
alter table public.employees add column if not exists labor_84_1_submitted_date date;
alter table public.employees add column if not exists labor_84_1_document_no text;
alter table public.employees add column if not exists labor_84_1_approval_no text;
alter table public.employees add column if not exists labor_84_1_approval_date date;
alter table public.employees add column if not exists labor_84_1_note text;

do $$ begin
  alter table public.employees add constraint employees_labor_84_1_status_check
    check (labor_84_1_status in ('not_submitted','submitted','supplement_required','approved','rejected'));
exception when duplicate_object then null; end $$;

alter table public.salary_advances add column if not exists approved_amount numeric(12,2) check (approved_amount is null or approved_amount >= 0);
alter table public.salary_advances add column if not exists disbursement_method text not null default 'cash';
alter table public.salary_advances add column if not exists repayment_method text not null default 'single';
alter table public.salary_advances add column if not exists installment_amount numeric(12,2) check (installment_amount is null or installment_amount >= 0);

do $$ begin
  alter table public.salary_advances add constraint salary_advances_disbursement_method_check check (disbursement_method in ('cash','bank_transfer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.salary_advances add constraint salary_advances_repayment_method_check check (repayment_method in ('single','installment'));
exception when duplicate_object then null; end $$;
