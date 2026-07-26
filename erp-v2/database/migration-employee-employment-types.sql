begin;

alter table public.employees
  drop constraint if exists employees_employment_type_check;

alter table public.employees
  add constraint employees_employment_type_check
  check (
    employment_type in (
      'full_time',
      'mobile',
      'internal',
      'part_time',
      'cash_shift',
      'temporary'
    )
  );

comment on column public.employees.employment_type is
  '身分類別：full_time 正職、mobile 機動、internal 內部、part_time 兼職、cash_shift 現金班、temporary 臨時／支援';

commit;

select '員工身分類別已擴充完成' as status;
