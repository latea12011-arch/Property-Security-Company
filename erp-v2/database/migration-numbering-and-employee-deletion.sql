-- 可編輯的員工／文件編號規則。
create table if not exists public.numbering_rules (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('employee','termination_certificate')),
  rule_name text not null,
  prefix text not null default '',
  digits integer not null default 3 check (digits between 1 and 10),
  start_number integer not null default 1 check (start_number >= 0),
  match_job_title text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, rule_name)
);

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

drop trigger if exists numbering_rules_updated on public.numbering_rules;
create trigger numbering_rules_updated before update on public.numbering_rules
for each row execute function public.set_updated_at();

select 'numbering rules installed' as status;
