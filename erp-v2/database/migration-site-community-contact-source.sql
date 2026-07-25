-- 案場管理：社區聯絡資料與案場來源
alter table public.sites
  add column if not exists community_tax_id text,
  add column if not exists community_phone text,
  add column if not exists acquisition_source text not null default 'direct',
  add column if not exists referrer_name text,
  add column if not exists schedule_print_footer text,
  add column if not exists schedule_print_notes text;

update public.sites
set acquisition_source = 'direct'
where acquisition_source is null
   or acquisition_source not in ('direct', 'partner');

alter table public.sites
  drop constraint if exists sites_community_tax_id_check;
alter table public.sites
  add constraint sites_community_tax_id_check
  check (community_tax_id is null or community_tax_id ~ '^[0-9]{8}$');

alter table public.sites
  drop constraint if exists sites_acquisition_source_check;
alter table public.sites
  add constraint sites_acquisition_source_check
  check (acquisition_source in ('direct', 'partner'));

alter table public.sites
  drop constraint if exists sites_referrer_name_check;
alter table public.sites
  add constraint sites_referrer_name_check
  check (acquisition_source <> 'partner' or nullif(btrim(referrer_name), '') is not null);

comment on column public.sites.community_tax_id is '社區統一編號';
comment on column public.sites.community_phone is '社區聯絡電話';
comment on column public.sites.acquisition_source is '案場來源：direct 公司自行承接；partner 他人介紹或合作';
comment on column public.sites.referrer_name is '介紹人或合作來源名稱';
comment on column public.sites.schedule_print_footer is '整月班表列印頁尾的公司及聯絡資訊';
comment on column public.sites.schedule_print_notes is '整月班表列印頁尾的勤務方式與備註';
