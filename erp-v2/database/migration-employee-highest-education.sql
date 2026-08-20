-- 員工最高學歷：員工管理、警局核備與 84-1 核備共用。
alter table public.employees
  add column if not exists highest_education text;

comment on column public.employees.highest_education is '員工最高學歷，供人事及核備清冊使用';

select 'employee highest education installed' as status;
