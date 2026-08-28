-- 員工緊急聯絡人的身分關係，例如父子、配偶、兄弟姊妹或朋友。
alter table public.employees
  add column if not exists emergency_contact_relationship text;

comment on column public.employees.emergency_contact_relationship is '緊急聯絡人與員工的關係';

select 'employee emergency contact relationship installed' as status;
