-- 可編輯的員工／文件編號規則。
create table if not exists public.numbering_rules (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('employee','termination_certificate')),
  rule_name text not null,
  prefix text not null default '',
  digits integer not null default 3 check (digits between 1 and 10),
  start_number integer not null default 1 check (start_number >= 0),
  last_number integer not null default 0 check (last_number >= 0),
  match_job_title text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, rule_name)
);
alter table public.numbering_rules
  add column if not exists last_number integer not null default 0 check (last_number >= 0);

alter table public.numbering_rules enable row level security;
drop policy if exists "authenticated reads numbering rules" on public.numbering_rules;
create policy "authenticated reads numbering rules" on public.numbering_rules
for select to authenticated using (true);
drop policy if exists "admins manage numbering rules" on public.numbering_rules;
create policy "admins manage numbering rules" on public.numbering_rules
for all to authenticated
using (public.current_user_role()='admin')
with check (public.current_user_role()='admin');
grant select,insert,update,delete on public.numbering_rules to authenticated;

alter table public.employees
  add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.termination_certificates
  add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;

insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,match_job_title,is_default,is_active,sort_order)
values
  ('employee','一般員工','A',3,1,null,true,true,10),
  ('employee','現金班人員','B',3,1,null,false,true,20),
  ('employee','總幹事','C',3,1,'總幹事',false,true,30),
  ('termination_certificate','離職證明書','HJ-TERM-',5,1,null,true,true,10)
on conflict (target_type,rule_name) do nothing;

-- 依 ERP 現有職稱預先建立完整分類；規則仍可由管理員自行修改。
insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,match_job_title,is_default,is_active,sort_order)
values
  ('employee','機動保全人員','D',3,1,'機動保全員',false,true,40),
  ('employee','案場主任','E',3,1,'案場主任',false,true,50),
  ('employee','社區秘書','F',3,1,'社區秘書',false,true,60),
  ('employee','勤務督導','G',3,1,'勤務督導',false,true,70),
  ('employee','行政專員','H',3,1,'行政專員',false,true,80),
  ('employee','人事專員','I',3,1,'人事專員',false,true,90),
  ('employee','會計專員','J',3,1,'會計專員',false,true,100),
  ('employee','業務人員','K',3,1,'業務人員',false,true,110),
  ('employee','業務經理','L',3,1,'業務經理',false,true,120),
  ('employee','部門主管','M',3,1,'部門主管',false,true,130),
  ('employee','總經理','N',3,1,'總經理',false,true,140)
on conflict (target_type,rule_name) do nothing;

update public.numbering_rules
set match_job_title='保全員'
where target_type='employee' and rule_name='一般員工' and match_job_title is null;

drop trigger if exists numbering_rules_updated on public.numbering_rules;
create trigger numbering_rules_updated before update on public.numbering_rules
for each row execute function public.set_updated_at();

-- 舊資料先納入已使用流水號，避免永久刪除後再次使用相同編號。
update public.numbering_rules rule
set last_number=greatest(rule.last_number,coalesce((
  select max(substring(employee.employee_no from length(rule.prefix)+1)::integer)
  from public.employees employee
  where rule.target_type='employee'
    and left(employee.employee_no,length(rule.prefix))=rule.prefix
    and length(substring(employee.employee_no from length(rule.prefix)+1))=rule.digits
    and substring(employee.employee_no from length(rule.prefix)+1) ~ '^[0-9]+$'
),0),coalesce((
  select max(substring(cert.certificate_no from length(rule.prefix)+1)::integer)
  from public.termination_certificates cert
  where rule.target_type='termination_certificate'
    and left(cert.certificate_no,length(rule.prefix))=rule.prefix
    and length(substring(cert.certificate_no from length(rule.prefix)+1))=rule.digits
    and substring(cert.certificate_no from length(rule.prefix)+1) ~ '^[0-9]+$'
),0));

create or replace function public.remember_used_document_number()
returns trigger language plpgsql security definer set search_path=public as $$
declare rule public.numbering_rules%rowtype; number_text text;
begin
  if new.numbering_rule_id is null then return new; end if;
  select * into rule from public.numbering_rules where id=new.numbering_rule_id;
  if not found then return new; end if;
  number_text := substring(case when tg_table_name='employees' then new.employee_no else new.certificate_no end from length(rule.prefix)+1);
  if left(case when tg_table_name='employees' then new.employee_no else new.certificate_no end,length(rule.prefix))=rule.prefix
     and length(number_text)=rule.digits and number_text ~ '^[0-9]+$' then
    update public.numbering_rules set last_number=greatest(last_number,number_text::integer) where id=rule.id;
  end if;
  return new;
end $$;
drop trigger if exists employees_remember_number on public.employees;
create trigger employees_remember_number after insert or update of employee_no,numbering_rule_id on public.employees
for each row execute function public.remember_used_document_number();
drop trigger if exists termination_remember_number on public.termination_certificates;
create trigger termination_remember_number after insert or update of certificate_no,numbering_rule_id on public.termination_certificates
for each row execute function public.remember_used_document_number();

select 'numbering rules installed' as status;
