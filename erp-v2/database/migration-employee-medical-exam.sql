begin;

alter table public.employees
  add column if not exists medical_exam_status text not null default 'not_submitted';

alter table public.employees
  add column if not exists medical_exam_date date;

alter table public.employees
  drop constraint if exists employees_medical_exam_status_check;

alter table public.employees
  add constraint employees_medical_exam_status_check
  check (medical_exam_status in ('not_submitted', 'submitted'));

comment on column public.employees.medical_exam_status is
  '近半年體檢報告繳交狀態：not_submitted 未繳交、submitted 已繳交';

comment on column public.employees.medical_exam_date is
  '員工最近一次健康檢查日期';

notify pgrst, 'reload schema';

commit;

select '員工近半年體檢報告繳交狀態已安裝' as status;
