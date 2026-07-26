-- Add explicit tax modes to tender quotations and formal service contracts.
-- Existing rows keep the historical "tax excluded" calculation. New records
-- default to tax included unless the user selects another mode.

alter table public.tender_quotations
  add column if not exists tax_mode text not null default 'tax_excluded';
alter table public.tender_quotations
  alter column tax_mode set default 'tax_included';

alter table public.tender_contracts
  add column if not exists tax_mode text not null default 'tax_excluded';
alter table public.tender_contracts
  alter column tax_mode set default 'tax_included';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='tender_quotations_tax_mode_check'
      and conrelid='public.tender_quotations'::regclass
  ) then
    alter table public.tender_quotations
      add constraint tender_quotations_tax_mode_check
      check (tax_mode in ('tax_included','tax_excluded','tax_exempt'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='tender_contracts_tax_mode_check'
      and conrelid='public.tender_contracts'::regclass
  ) then
    alter table public.tender_contracts
      add constraint tender_contracts_tax_mode_check
      check (tax_mode in ('tax_included','tax_excluded','tax_exempt'));
  end if;
end $$;

create or replace function public.save_tender_quotation(target_id uuid, header jsonb, items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  qid uuid;
  entered_amount numeric;
  subtotal numeric;
  fee numeric := 0;
  tax numeric;
  total numeric;
  months integer;
  rate numeric;
  normalized_tax_mode text;
begin
  if not public.has_feature_permission('tenderQuotations') then
    raise exception '沒有競標報價管理權限';
  end if;

  normalized_tax_mode := coalesce(nullif(header->>'tax_mode',''),'tax_included');
  if normalized_tax_mode not in ('tax_included','tax_excluded','tax_exempt') then
    raise exception '課稅方式不正確';
  end if;

  if target_id is null then
    insert into public.tender_quotations(
      quote_no,client_name,project_name,site_address,quote_date,valid_until,
      contract_start_date,contract_end_date,contract_months,management_fee_rate,
      tax_rate,tax_mode,status,terms,note
    ) values (
      header->>'quote_no',header->>'client_name',header->>'project_name',
      nullif(header->>'site_address',''),coalesce((header->>'quote_date')::date,current_date),
      nullif(header->>'valid_until','')::date,nullif(header->>'contract_start_date','')::date,
      nullif(header->>'contract_end_date','')::date,
      coalesce(nullif(header->>'contract_months','')::integer,12),0,
      coalesce(nullif(header->>'tax_rate','')::numeric,5),normalized_tax_mode,
      coalesce(header->>'status','draft'),header->>'terms',header->>'note'
    ) returning id into qid;
  else
    update public.tender_quotations set
      quote_no=header->>'quote_no',client_name=header->>'client_name',
      project_name=header->>'project_name',site_address=nullif(header->>'site_address',''),
      quote_date=coalesce((header->>'quote_date')::date,current_date),
      valid_until=nullif(header->>'valid_until','')::date,
      contract_start_date=nullif(header->>'contract_start_date','')::date,
      contract_end_date=nullif(header->>'contract_end_date','')::date,
      contract_months=coalesce(nullif(header->>'contract_months','')::integer,12),
      management_fee_rate=0,tax_rate=coalesce(nullif(header->>'tax_rate','')::numeric,5),
      tax_mode=normalized_tax_mode,status=coalesce(header->>'status','draft'),
      terms=header->>'terms',note=header->>'note',updated_at=now()
    where id=target_id returning id into qid;
    if qid is null then raise exception '找不到報價資料'; end if;
    delete from public.tender_quotation_items where quotation_id=qid;
  end if;

  insert into public.tender_quotation_items(
    quotation_id,sort_order,role_type,role_name,headcount,monthly_salary,
    labor_insurance,health_insurance,pension_contribution,group_insurance,
    overtime_allowance,equipment_uniform,other_monthly_cost,
    unit_monthly_cost,line_monthly_total,note
  )
  select qid,x.sort_order,x.role_type,x.role_name,x.headcount,x.monthly_salary,
    x.labor_insurance,x.health_insurance,x.pension_contribution,x.group_insurance,
    x.overtime_allowance,x.equipment_uniform,x.other_monthly_cost,
    x.monthly_salary+x.labor_insurance+x.health_insurance+x.pension_contribution+
      x.group_insurance+x.overtime_allowance+x.equipment_uniform+x.other_monthly_cost,
    (x.monthly_salary+x.labor_insurance+x.health_insurance+x.pension_contribution+
      x.group_insurance+x.overtime_allowance+x.equipment_uniform+x.other_monthly_cost)*x.headcount,
    x.note
  from jsonb_to_recordset(coalesce(items,'[]'::jsonb)) as x(
    sort_order integer,role_type text,role_name text,headcount numeric,
    monthly_salary numeric,labor_insurance numeric,health_insurance numeric,
    pension_contribution numeric,group_insurance numeric,overtime_allowance numeric,
    equipment_uniform numeric,other_monthly_cost numeric,note text
  );

  select coalesce(sum(line_monthly_total),0) into entered_amount
  from public.tender_quotation_items where quotation_id=qid;
  select contract_months,tax_rate into months,rate
  from public.tender_quotations where id=qid;

  if normalized_tax_mode='tax_excluded' then
    subtotal := entered_amount;
    tax := round(subtotal*rate/100,2);
    total := subtotal+tax;
  elsif normalized_tax_mode='tax_included' then
    total := entered_amount;
    subtotal := case when rate>0 then round(total/(1+rate/100),2) else total end;
    tax := total-subtotal;
  else
    subtotal := entered_amount;
    tax := 0;
    total := subtotal;
  end if;

  update public.tender_quotations set
    monthly_staff_cost=subtotal,monthly_management_fee=fee,monthly_tax=tax,
    monthly_total=total,contract_total=total*months,updated_at=now()
  where id=qid;
  return qid;
end $$;

create or replace function public.save_tender_contract(target_id uuid, header jsonb, items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  cid uuid;
  entered_amount numeric;
  subtotal numeric;
  tax numeric;
  total numeric;
  rate numeric;
  normalized_type text;
  normalized_company text;
  normalized_details jsonb;
  normalized_tax_mode text;
begin
  if not public.has_feature_permission('tenderContracts') then
    raise exception '沒有正式合約管理權限';
  end if;

  normalized_type := coalesce(header->>'contract_type','property');
  if normalized_type not in ('property','security') then
    raise exception '合約類型不正確';
  end if;
  normalized_company := case when normalized_type='property'
    then '紘嘉公寓大廈管理維護股份有限公司'
    else '紘嘉保全股份有限公司' end;
  normalized_details := coalesce(nullif(header->>'formal_details','')::jsonb,'{}'::jsonb);
  normalized_tax_mode := coalesce(nullif(header->>'tax_mode',''),'tax_included');
  if normalized_tax_mode not in ('tax_included','tax_excluded','tax_exempt') then
    raise exception '課稅方式不正確';
  end if;

  if target_id is null then
    insert into public.tender_contracts(
      contract_no,quotation_id,contract_type,company_name,client_name,client_representative,
      project_name,site_address,contract_start_date,contract_end_date,contract_months,
      payment_due_day,tax_rate,tax_mode,service_scope,contract_terms,formal_details,status,note
    ) values (
      header->>'contract_no',nullif(header->>'quotation_id','')::uuid,normalized_type,
      normalized_company,header->>'client_name',nullif(header->>'client_representative',''),
      header->>'project_name',nullif(header->>'site_address',''),
      nullif(header->>'contract_start_date','')::date,nullif(header->>'contract_end_date','')::date,
      coalesce(nullif(header->>'contract_months','')::integer,12),
      coalesce(nullif(header->>'payment_due_day','')::integer,10),
      coalesce(nullif(header->>'tax_rate','')::numeric,5),normalized_tax_mode,
      header->>'service_scope',header->>'contract_terms',normalized_details,
      coalesce(header->>'status','draft'),header->>'note'
    ) returning id into cid;
  else
    update public.tender_contracts set
      contract_no=header->>'contract_no',quotation_id=nullif(header->>'quotation_id','')::uuid,
      contract_type=normalized_type,company_name=normalized_company,
      client_name=header->>'client_name',
      client_representative=nullif(header->>'client_representative',''),
      project_name=header->>'project_name',site_address=nullif(header->>'site_address',''),
      contract_start_date=nullif(header->>'contract_start_date','')::date,
      contract_end_date=nullif(header->>'contract_end_date','')::date,
      contract_months=coalesce(nullif(header->>'contract_months','')::integer,12),
      payment_due_day=coalesce(nullif(header->>'payment_due_day','')::integer,10),
      tax_rate=coalesce(nullif(header->>'tax_rate','')::numeric,5),
      tax_mode=normalized_tax_mode,service_scope=header->>'service_scope',
      contract_terms=header->>'contract_terms',formal_details=normalized_details,
      status=coalesce(header->>'status','draft'),note=header->>'note',updated_at=now()
    where id=target_id returning id into cid;
    if cid is null then raise exception '找不到合約資料'; end if;
    delete from public.tender_contract_items where contract_id=cid;
  end if;

  insert into public.tender_contract_items(
    contract_id,source_quotation_item_id,sort_order,role_type,role_name,headcount,
    unit_monthly_amount,line_monthly_total,work_description
  )
  select cid,x.source_quotation_item_id,x.sort_order,x.role_type,x.role_name,x.headcount,
    x.unit_monthly_amount,round(x.unit_monthly_amount*x.headcount,2),x.work_description
  from jsonb_to_recordset(coalesce(items,'[]'::jsonb)) as x(
    source_quotation_item_id uuid,sort_order integer,role_type text,role_name text,
    headcount numeric,unit_monthly_amount numeric,line_monthly_total numeric,
    work_description text
  );

  select coalesce(sum(line_monthly_total),0) into entered_amount
  from public.tender_contract_items where contract_id=cid;
  select tax_rate into rate from public.tender_contracts where id=cid;

  if normalized_tax_mode='tax_excluded' then
    subtotal := entered_amount;
    tax := round(subtotal*rate/100,2);
    total := subtotal+tax;
  elsif normalized_tax_mode='tax_included' then
    total := entered_amount;
    subtotal := case when rate>0 then round(total/(1+rate/100),2) else total end;
    tax := total-subtotal;
  else
    subtotal := entered_amount;
    tax := 0;
    total := subtotal;
  end if;

  update public.tender_contracts set
    monthly_subtotal=subtotal,monthly_tax=tax,monthly_total=total,updated_at=now()
  where id=cid;
  return cid;
end $$;

grant execute on function public.save_tender_quotation(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.save_tender_contract(uuid,jsonb,jsonb) to authenticated;

select pg_notify('pgrst','reload schema');
