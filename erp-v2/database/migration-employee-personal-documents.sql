-- 員工個人資料與身分證件私人附件

alter table public.employees
  add column if not exists national_id text,
  add column if not exists registered_address text,
  add column if not exists residential_address text,
  add column if not exists driver_license_type text,
  add column if not exists transportation_method text,
  add column if not exists chief_manager_certificate_no text,
  add column if not exists id_document_path text;

comment on column public.employees.national_id is '身分證字號；僅供授權人事管理用途';
comment on column public.employees.registered_address is '戶籍地址';
comment on column public.employees.residential_address is '現居地址';
comment on column public.employees.driver_license_type is '駕照類別';
comment on column public.employees.transportation_method is '主要交通方式';
comment on column public.employees.chief_manager_certificate_no is '公寓大廈事務管理人員／總幹事證號';
comment on column public.employees.id_document_path is 'hr-private bucket 內的身分證件私人檔案路徑';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hr-private','hr-private',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,
allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

grant select,insert,update on public.employees to authenticated;

select 'employee personal documents migration installed' as result;
