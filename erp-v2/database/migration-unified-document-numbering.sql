-- 統一管理 ERP 正式編號／單號。可重複執行。
alter table public.numbering_rules drop constraint if exists numbering_rules_target_type_check;
alter table public.numbering_rules add constraint numbering_rules_target_type_check check (target_type in (
  'employee','site','supervisor_inspection','leave_request','bullying_complaint',
  'salary_advance','payroll_record','termination_certificate','tender_quotation',
  'property_contract','security_contract','vendor','inventory_item',
  'inventory_transaction','inventory_loan'
));

alter table public.sites add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.supervisor_inspections add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.supervisor_inspections add column if not exists inspection_no text;
alter table public.leave_requests add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.leave_requests add column if not exists request_no text;
alter table public.bullying_complaints add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.bullying_complaints add column if not exists case_no text;
alter table public.salary_advances add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.salary_advances add column if not exists advance_no text;
alter table public.payroll_records add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.payroll_records add column if not exists payroll_no text;
alter table public.vendors add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.inventory_items add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.inventory_transactions add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;
alter table public.inventory_loans add column if not exists numbering_rule_id uuid references public.numbering_rules(id) on delete set null;

create unique index if not exists supervisor_inspections_no_unique on public.supervisor_inspections(inspection_no) where inspection_no is not null;
create unique index if not exists leave_requests_no_unique on public.leave_requests(request_no) where request_no is not null;
create unique index if not exists bullying_complaints_no_unique on public.bullying_complaints(case_no) where case_no is not null;
create unique index if not exists salary_advances_no_unique on public.salary_advances(advance_no) where advance_no is not null;
create unique index if not exists payroll_records_no_unique on public.payroll_records(payroll_no) where payroll_no is not null;

insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,last_number,match_job_title,is_default,is_active,sort_order)
values
  ('site','案場代碼','SITE-',4,1,0,null,true,true,10),
  ('supervisor_inspection','督導巡查單','INS-',6,1,0,null,true,true,20),
  ('leave_request','請假申請單','LEAVE-',6,1,0,null,true,true,30),
  ('bullying_complaint','申訴案件','CASE-',6,1,0,null,true,true,40),
  ('salary_advance','員工借支單','ADV-',6,1,0,null,true,true,50),
  ('payroll_record','薪資明細單','PAY-',6,1,0,null,true,true,60),
  ('tender_quotation','競標報價單','Q-',6,1,0,null,true,true,80),
  ('property_contract','物業合約','C-P-',6,1,0,null,true,true,90),
  ('security_contract','保全合約','C-S-',6,1,0,null,true,true,100),
  ('vendor','合作廠商','V',4,1,0,null,true,true,110),
  ('inventory_item','庫存物品','ITEM-',5,1,0,null,true,true,120),
  ('inventory_transaction','庫存異動／領取單','INV-',6,1,0,null,true,true,130),
  ('inventory_loan','設備借用單','LOAN-',6,1,0,null,true,true,140)
on conflict (target_type,rule_name) do nothing;

create or replace function public.reserve_document_number(p_target_type text,p_rule_id uuid default null)
returns text language plpgsql security definer set search_path=public as $$
declare selected_rule public.numbering_rules%rowtype; next_value integer;
begin
  if auth.uid() is null then raise exception '需要登入後才能取得單號'; end if;
  select * into selected_rule
  from public.numbering_rules
  where is_active=true and target_type=p_target_type
    and (p_rule_id is null or id=p_rule_id)
  order by case when id=p_rule_id then 0 when is_default then 1 else 2 end,sort_order,id
  for update limit 1;
  if not found then raise exception '找不到可用的編號規則：%',p_target_type; end if;
  next_value:=greatest(selected_rule.start_number,selected_rule.last_number+1);
  update public.numbering_rules set last_number=next_value where id=selected_rule.id;
  return selected_rule.prefix||lpad(next_value::text,selected_rule.digits,'0');
end $$;
revoke all on function public.reserve_document_number(text,uuid) from public;
grant execute on function public.reserve_document_number(text,uuid) to authenticated;

create or replace function public.ensure_managed_document_number()
returns trigger language plpgsql security definer set search_path=public as $$
declare target text:=tg_argv[0]; field_name text:=tg_argv[1]; current_no text; rule_id uuid; rule_row public.numbering_rules%rowtype; number_part text;
begin
  if target='contract_by_type' then target:=case when to_jsonb(new)->>'contract_type'='security' then 'security_contract' else 'property_contract' end; end if;
  current_no:=to_jsonb(new)->>field_name;
  if current_no is null or btrim(current_no)='' or
     (target='tender_quotation' and current_no ~ '^Q-[0-9]{8}-[0-9]{4}$') or
     (target in ('property_contract','security_contract') and current_no ~ '^C-[PS]-[0-9]{8}-[0-9]{4}$') then
    begin rule_id:=nullif(to_jsonb(new)->>'numbering_rule_id','')::uuid; exception when others then rule_id:=null; end;
    current_no:=public.reserve_document_number(target,rule_id);
    new:=jsonb_populate_record(new,jsonb_build_object(field_name,current_no));
    return new;
  end if;
  begin rule_id:=nullif(to_jsonb(new)->>'numbering_rule_id','')::uuid; exception when others then rule_id:=null; end;
  select * into rule_row from public.numbering_rules
    where is_active=true and target_type=target and (rule_id is null or id=rule_id)
    order by case when id=rule_id then 0 when is_default then 1 else 2 end,sort_order,id limit 1;
  if found and left(current_no,length(rule_row.prefix))=rule_row.prefix then
    number_part:=substring(current_no from length(rule_row.prefix)+1);
    if length(number_part)=rule_row.digits and number_part ~ '^[0-9]+$' then
      update public.numbering_rules set last_number=greatest(last_number,number_part::integer) where id=rule_row.id;
    end if;
  end if;
  return new;
end $$;

do $$
declare item record;
begin
  for item in select * from (values
    ('employees','employee','employee_no'),('sites','site','code'),('supervisor_inspections','supervisor_inspection','inspection_no'),
    ('leave_requests','leave_request','request_no'),('bullying_complaints','bullying_complaint','case_no'),
    ('salary_advances','salary_advance','advance_no'),('payroll_records','payroll_record','payroll_no'),
    ('termination_certificates','termination_certificate','certificate_no'),('vendors','vendor','vendor_code'),
    ('inventory_items','inventory_item','item_code'),('inventory_transactions','inventory_transaction','document_no'),
    ('inventory_loans','inventory_loan','document_no'),('tender_quotations','tender_quotation','quote_no'),
    ('tender_contracts','contract_by_type','contract_no')
  ) as mapping(table_name,target_type,field_name)
  loop
    execute format('drop trigger if exists managed_number_before_save on public.%I',item.table_name);
    execute format('create trigger managed_number_before_save before insert or update of %I on public.%I for each row execute function public.ensure_managed_document_number(%L,%L)',item.field_name,item.table_name,item.target_type,item.field_name);
  end loop;
end $$;

notify pgrst,'reload schema';
select 'unified document numbering installed' as status;
