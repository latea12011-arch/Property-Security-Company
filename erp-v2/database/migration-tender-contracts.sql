-- 業務與競標：由報價單建立物業／保全合約
create table if not exists public.tender_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_no text not null unique,
  quotation_id uuid references public.tender_quotations(id) on delete set null,
  contract_type text not null check (contract_type in ('property','security')),
  company_name text not null,
  client_name text not null,
  client_representative text,
  project_name text not null,
  site_address text,
  contract_start_date date,
  contract_end_date date,
  contract_months integer not null default 12 check (contract_months > 0),
  payment_due_day integer not null default 10 check (payment_due_day between 1 and 31),
  tax_rate numeric(7,3) not null default 5 check (tax_rate >= 0),
  monthly_subtotal numeric(14,2) not null default 0,
  monthly_tax numeric(14,2) not null default 0,
  monthly_total numeric(14,2) not null default 0,
  service_scope text,
  contract_terms text,
  status text not null default 'draft' check (status in ('draft','attached','signed','active','expired','cancelled')),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contract_end_date is null or contract_start_date is null or contract_end_date >= contract_start_date)
);

create table if not exists public.tender_contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.tender_contracts(id) on delete cascade,
  source_quotation_item_id uuid references public.tender_quotation_items(id) on delete set null,
  sort_order integer not null default 0,
  role_type text not null default 'other',
  role_name text not null,
  headcount numeric(8,2) not null default 1 check (headcount > 0),
  unit_monthly_amount numeric(14,2) not null default 0 check (unit_monthly_amount >= 0),
  line_monthly_total numeric(14,2) not null default 0 check (line_monthly_total >= 0),
  work_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tender_contracts_quote_idx on public.tender_contracts(quotation_id);
create index if not exists tender_contracts_status_date_idx on public.tender_contracts(status,contract_start_date desc);
create index if not exists tender_contract_items_contract_idx on public.tender_contract_items(contract_id,sort_order);

create or replace function public.save_tender_contract(target_id uuid, header jsonb, items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  cid uuid;
  subtotal numeric;
  tax numeric;
  total numeric;
  normalized_type text;
  normalized_company text;
begin
  if not public.has_feature_permission('tenderContracts') then
    raise exception '沒有合約管理功能權限';
  end if;

  normalized_type := coalesce(header->>'contract_type','property');
  if normalized_type not in ('property','security') then raise exception '合約類型不正確'; end if;
  normalized_company := case when normalized_type='property'
    then '紘嘉公寓大廈管理維護股份有限公司'
    else '紘嘉保全股份有限公司' end;

  if target_id is null then
    insert into public.tender_contracts(
      contract_no,quotation_id,contract_type,company_name,client_name,client_representative,
      project_name,site_address,contract_start_date,contract_end_date,contract_months,
      payment_due_day,tax_rate,service_scope,contract_terms,status,note
    ) values (
      header->>'contract_no',nullif(header->>'quotation_id','')::uuid,normalized_type,normalized_company,
      header->>'client_name',nullif(header->>'client_representative',''),header->>'project_name',
      nullif(header->>'site_address',''),nullif(header->>'contract_start_date','')::date,
      nullif(header->>'contract_end_date','')::date,coalesce(nullif(header->>'contract_months','')::integer,12),
      coalesce(nullif(header->>'payment_due_day','')::integer,10),coalesce(nullif(header->>'tax_rate','')::numeric,5),
      header->>'service_scope',header->>'contract_terms',coalesce(header->>'status','draft'),header->>'note'
    ) returning id into cid;
  else
    update public.tender_contracts set
      contract_no=header->>'contract_no',quotation_id=nullif(header->>'quotation_id','')::uuid,
      contract_type=normalized_type,company_name=normalized_company,client_name=header->>'client_name',
      client_representative=nullif(header->>'client_representative',''),project_name=header->>'project_name',
      site_address=nullif(header->>'site_address',''),contract_start_date=nullif(header->>'contract_start_date','')::date,
      contract_end_date=nullif(header->>'contract_end_date','')::date,
      contract_months=coalesce(nullif(header->>'contract_months','')::integer,12),
      payment_due_day=coalesce(nullif(header->>'payment_due_day','')::integer,10),
      tax_rate=coalesce(nullif(header->>'tax_rate','')::numeric,5),service_scope=header->>'service_scope',
      contract_terms=header->>'contract_terms',status=coalesce(header->>'status','draft'),note=header->>'note',updated_at=now()
    where id=target_id returning id into cid;
    if cid is null then raise exception '找不到合約'; end if;
    delete from public.tender_contract_items where contract_id=cid;
  end if;

  insert into public.tender_contract_items(
    contract_id,source_quotation_item_id,sort_order,role_type,role_name,headcount,
    unit_monthly_amount,line_monthly_total,work_description
  )
  select cid,x.source_quotation_item_id,x.sort_order,x.role_type,x.role_name,x.headcount,
    x.unit_monthly_amount,round(x.unit_monthly_amount*x.headcount,2),x.work_description
  from jsonb_to_recordset(coalesce(items,'[]'::jsonb)) as x(
    source_quotation_item_id uuid,sort_order integer,role_type text,role_name text,headcount numeric,
    unit_monthly_amount numeric,line_monthly_total numeric,work_description text
  );

  select coalesce(sum(line_monthly_total),0) into subtotal from public.tender_contract_items where contract_id=cid;
  select round(subtotal*tax_rate/100,2) into tax from public.tender_contracts where id=cid;
  total := subtotal + tax;
  update public.tender_contracts set monthly_subtotal=subtotal,monthly_tax=tax,monthly_total=total,updated_at=now() where id=cid;
  return cid;
end $$;

alter table public.tender_contracts enable row level security;
alter table public.tender_contract_items enable row level security;
drop policy if exists "authorized staff manage tender contracts" on public.tender_contracts;
drop policy if exists "authorized staff manage tender contract items" on public.tender_contract_items;
create policy "authorized staff manage tender contracts" on public.tender_contracts
for all to authenticated using(public.has_feature_permission('tenderContracts'))
with check(public.has_feature_permission('tenderContracts'));
create policy "authorized staff manage tender contract items" on public.tender_contract_items
for all to authenticated using(public.has_feature_permission('tenderContracts'))
with check(public.has_feature_permission('tenderContracts'));
grant select,insert,update,delete on public.tender_contracts,public.tender_contract_items to authenticated;
grant execute on function public.save_tender_contract(uuid,jsonb,jsonb) to authenticated;

drop trigger if exists tender_contracts_updated on public.tender_contracts;
create trigger tender_contracts_updated before update on public.tender_contracts
for each row execute function public.set_updated_at();
drop trigger if exists tender_contract_items_updated on public.tender_contract_items;
create trigger tender_contract_items_updated before update on public.tender_contract_items
for each row execute function public.set_updated_at();

do $$ begin
  if to_regprocedure('public.write_audit_log()') is not null then
    execute 'drop trigger if exists audit_changes on public.tender_contracts';
    execute 'create trigger audit_changes after insert or update or delete on public.tender_contracts for each row execute function public.write_audit_log()';
  end if;
end $$;
