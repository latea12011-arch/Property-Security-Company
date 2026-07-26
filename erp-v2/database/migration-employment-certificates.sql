-- 在職證明：在職狀態驗證、員工快照、可自訂編號、列印與 Word 下載。
create table if not exists public.employment_certificates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_no text not null default '',
  employee_name text not null default '',
  job_title text not null default '',
  hire_date date,
  company_type text not null default 'property' check (company_type in ('property','security')),
  purpose text not null default 'general' check (purpose in ('general','bank','rental','visa','government','school','other')),
  recipient text,
  salary_display boolean not null default false,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  issue_date date not null default current_date,
  certificate_no text unique,
  numbering_rule_id uuid references public.numbering_rules(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.numbering_rules drop constraint if exists numbering_rules_target_type_check;
alter table public.numbering_rules add constraint numbering_rules_target_type_check check (target_type in (
  'employee','site','supervisor_inspection','leave_request','bullying_complaint',
  'salary_advance','payroll_record','employment_certificate','termination_certificate','tender_quotation',
  'property_contract','security_contract','vendor','inventory_item',
  'inventory_transaction','inventory_loan'
));

insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,last_number,match_job_title,is_default,is_active,sort_order)
values ('employment_certificate','在職證明書','HJ-EMP-',5,1,0,null,true,true,70)
on conflict (target_type,rule_name) do nothing;

create or replace function public.prepare_employment_certificate()
returns trigger language plpgsql security definer set search_path=public as $$
declare employee_row public.employees%rowtype;
begin
  if new.employee_id is not null then
    select * into employee_row from public.employees where id=new.employee_id;
    if not found then raise exception '找不到指定員工'; end if;
    if employee_row.status <> 'active' then raise exception '只有在職員工可以開立在職證明'; end if;
    new.employee_no:=coalesce(employee_row.employee_no,'');
    new.employee_name:=coalesce(employee_row.full_name,'');
    new.job_title:=coalesce(employee_row.job_title,'');
    new.hire_date:=employee_row.hire_date;
  end if;
  return new;
end $$;

drop trigger if exists prepare_employment_certificate on public.employment_certificates;
create trigger prepare_employment_certificate before insert or update of employee_id
on public.employment_certificates for each row execute function public.prepare_employment_certificate();

drop trigger if exists managed_number_before_save on public.employment_certificates;
create trigger managed_number_before_save before insert or update of certificate_no
on public.employment_certificates for each row
execute function public.ensure_managed_document_number('employment_certificate','certificate_no');

drop trigger if exists employment_certificates_updated on public.employment_certificates;
create trigger employment_certificates_updated before update on public.employment_certificates
for each row execute function public.set_updated_at();

alter table public.employment_certificates enable row level security;
drop policy if exists "staff manages employment certificates" on public.employment_certificates;
create policy "staff manages employment certificates" on public.employment_certificates
for all to authenticated
using (public.has_feature_permission('employmentCertificates'))
with check (public.has_feature_permission('employmentCertificates'));

grant select,insert,update,delete on public.employment_certificates to authenticated;
notify pgrst,'reload schema';
select 'employment certificates installed' as status;
