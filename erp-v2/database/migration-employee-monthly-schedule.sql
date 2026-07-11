-- 舊版式「員工個人整月排班」需要的班別與休假支援。
alter table public.schedules drop constraint if exists schedules_shift_type_check;
alter table public.schedules alter column site_id drop not null;
alter table public.schedules add column if not exists work_time_text text;
alter table public.schedules add constraint schedules_shift_type_check
  check (shift_type in ('day','night','mobile','special','off','annual','personal','sick','custom'));

comment on column public.schedules.work_time_text is '行政輸入的顯示時段，例如 07-19';
