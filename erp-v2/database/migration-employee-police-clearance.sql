begin;

alter table public.employees
  add column if not exists police_clearance_status text not null default 'not_submitted';

alter table public.employees
  drop constraint if exists employees_police_clearance_status_check;

alter table public.employees
  add constraint employees_police_clearance_status_check
  check (police_clearance_status in ('not_submitted', 'submitted'));

comment on column public.employees.police_clearance_status is
  '良民證繳交狀態：not_submitted 未繳交、submitted 已繳交';

notify pgrst, 'reload schema';

commit;

select '員工良民證繳交狀態已安裝' as status;
