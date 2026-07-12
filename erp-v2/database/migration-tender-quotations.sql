-- 競標合約人力成本與報價
create table if not exists public.tender_quotations (
  id uuid primary key default gen_random_uuid(), quote_no text not null unique,
  client_name text not null, project_name text not null, site_address text,
  quote_date date not null default current_date, valid_until date,
  contract_start_date date, contract_end_date date, contract_months integer not null default 12 check(contract_months>0),
  management_fee_rate numeric(7,3) not null default 8 check(management_fee_rate>=0),
  tax_rate numeric(7,3) not null default 5 check(tax_rate>=0),
  monthly_staff_cost numeric(14,2) not null default 0,
  monthly_management_fee numeric(14,2) not null default 0,
  monthly_tax numeric(14,2) not null default 0,
  monthly_total numeric(14,2) not null default 0,
  contract_total numeric(16,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','submitted','won','lost','cancelled')),
  terms text, note text, created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(valid_until is null or valid_until>=quote_date),
  check(contract_end_date is null or contract_start_date is null or contract_end_date>=contract_start_date)
);

create table if not exists public.tender_quotation_items (
  id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.tender_quotations(id) on delete cascade,
  sort_order integer not null default 0, role_type text not null default 'other', role_name text not null,
  headcount numeric(8,2) not null default 1 check(headcount>0), monthly_salary numeric(12,2) not null default 0 check(monthly_salary>=0),
  labor_insurance numeric(12,2) not null default 0, health_insurance numeric(12,2) not null default 0,
  pension_contribution numeric(12,2) not null default 0, group_insurance numeric(12,2) not null default 0,
  overtime_allowance numeric(12,2) not null default 0, equipment_uniform numeric(12,2) not null default 0,
  other_monthly_cost numeric(12,2) not null default 0, unit_monthly_cost numeric(14,2) not null default 0,
  line_monthly_total numeric(14,2) not null default 0, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tender_quotations_status_date_idx on public.tender_quotations(status,quote_date desc);
create index if not exists tender_items_quotation_idx on public.tender_quotation_items(quotation_id,sort_order);

create or replace function public.save_tender_quotation(target_id uuid, header jsonb, items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare qid uuid; subtotal numeric; fee numeric; tax numeric; total numeric; months integer;
begin
  if not public.has_feature_permission('tenderQuotations') then raise exception '沒有競標報價功能權限'; end if;
  if target_id is null then
    insert into public.tender_quotations(quote_no,client_name,project_name,site_address,quote_date,valid_until,contract_start_date,contract_end_date,contract_months,management_fee_rate,tax_rate,status,terms,note)
    values(header->>'quote_no',header->>'client_name',header->>'project_name',nullif(header->>'site_address',''),coalesce((header->>'quote_date')::date,current_date),nullif(header->>'valid_until','')::date,nullif(header->>'contract_start_date','')::date,nullif(header->>'contract_end_date','')::date,coalesce((header->>'contract_months')::integer,12),coalesce((header->>'management_fee_rate')::numeric,8),coalesce((header->>'tax_rate')::numeric,5),coalesce(header->>'status','draft'),header->>'terms',header->>'note') returning id into qid;
  else
    update public.tender_quotations set quote_no=header->>'quote_no',client_name=header->>'client_name',project_name=header->>'project_name',site_address=nullif(header->>'site_address',''),quote_date=coalesce((header->>'quote_date')::date,current_date),valid_until=nullif(header->>'valid_until','')::date,contract_start_date=nullif(header->>'contract_start_date','')::date,contract_end_date=nullif(header->>'contract_end_date','')::date,contract_months=coalesce((header->>'contract_months')::integer,12),management_fee_rate=coalesce((header->>'management_fee_rate')::numeric,8),tax_rate=coalesce((header->>'tax_rate')::numeric,5),status=coalesce(header->>'status','draft'),terms=header->>'terms',note=header->>'note',updated_at=now() where id=target_id returning id into qid;
    if qid is null then raise exception '找不到報價單'; end if;
    delete from public.tender_quotation_items where quotation_id=qid;
  end if;
  insert into public.tender_quotation_items(quotation_id,sort_order,role_type,role_name,headcount,monthly_salary,labor_insurance,health_insurance,pension_contribution,group_insurance,overtime_allowance,equipment_uniform,other_monthly_cost,unit_monthly_cost,line_monthly_total,note)
  select qid,x.sort_order,x.role_type,x.role_name,x.headcount,x.monthly_salary,x.labor_insurance,x.health_insurance,x.pension_contribution,x.group_insurance,x.overtime_allowance,x.equipment_uniform,x.other_monthly_cost,
    x.monthly_salary+x.labor_insurance+x.health_insurance+x.pension_contribution+x.group_insurance+x.overtime_allowance+x.equipment_uniform+x.other_monthly_cost,
    (x.monthly_salary+x.labor_insurance+x.health_insurance+x.pension_contribution+x.group_insurance+x.overtime_allowance+x.equipment_uniform+x.other_monthly_cost)*x.headcount,x.note
  from jsonb_to_recordset(coalesce(items,'[]'::jsonb)) as x(sort_order integer,role_type text,role_name text,headcount numeric,monthly_salary numeric,labor_insurance numeric,health_insurance numeric,pension_contribution numeric,group_insurance numeric,overtime_allowance numeric,equipment_uniform numeric,other_monthly_cost numeric,note text);
  select coalesce(sum(line_monthly_total),0) into subtotal from public.tender_quotation_items where quotation_id=qid;
  select contract_months,round(subtotal*management_fee_rate/100,2) into months,fee from public.tender_quotations where id=qid;
  select round((subtotal+fee)*tax_rate/100,2) into tax from public.tender_quotations where id=qid;
  total:=subtotal+fee+tax;
  update public.tender_quotations set monthly_staff_cost=subtotal,monthly_management_fee=fee,monthly_tax=tax,monthly_total=total,contract_total=total*months,updated_at=now() where id=qid;
  return qid;
end $$;

alter table public.tender_quotations enable row level security; alter table public.tender_quotation_items enable row level security;
drop policy if exists "authorized staff manage quotations" on public.tender_quotations;
drop policy if exists "authorized staff manage quotation items" on public.tender_quotation_items;
create policy "authorized staff manage quotations" on public.tender_quotations for all to authenticated using(public.has_feature_permission('tenderQuotations')) with check(public.has_feature_permission('tenderQuotations'));
create policy "authorized staff manage quotation items" on public.tender_quotation_items for all to authenticated using(public.has_feature_permission('tenderQuotations')) with check(public.has_feature_permission('tenderQuotations'));
grant select,insert,update,delete on public.tender_quotations,public.tender_quotation_items to authenticated;
grant execute on function public.save_tender_quotation(uuid,jsonb,jsonb) to authenticated;

drop trigger if exists tender_quotations_updated on public.tender_quotations; create trigger tender_quotations_updated before update on public.tender_quotations for each row execute function public.set_updated_at();
drop trigger if exists tender_items_updated on public.tender_quotation_items; create trigger tender_items_updated before update on public.tender_quotation_items for each row execute function public.set_updated_at();
do $$ begin if to_regprocedure('public.write_audit_log()') is not null then execute 'drop trigger if exists audit_changes on public.tender_quotations';execute 'create trigger audit_changes after insert or update or delete on public.tender_quotations for each row execute function public.write_audit_log()';end if;end $$;
