-- 正式勞務合約：封面、設備勾選、付款、賠償、簽約與附件資料
alter table public.tender_contracts
  add column if not exists formal_details jsonb not null default '{}'::jsonb;

comment on column public.tender_contracts.formal_details is
  '正式勞務合約可變動內容：甲方資料、銀行、設備勾選、賠償、終止、簽約及附件';

create or replace function public.save_tender_contract(target_id uuid, header jsonb, items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  cid uuid;
  subtotal numeric;
  tax numeric;
  total numeric;
  normalized_type text;
  normalized_company text;
  normalized_details jsonb;
begin
  if not public.has_feature_permission('tenderContracts') then
    raise exception '沒有合約管理功能權限';
  end if;

  normalized_type := coalesce(header->>'contract_type','property');
  if normalized_type not in ('property','security') then
    raise exception '合約類型不正確';
  end if;
  normalized_company := case when normalized_type='property'
    then '紘嘉公寓大廈管理維護股份有限公司'
    else '紘嘉保全股份有限公司' end;
  normalized_details := coalesce(nullif(header->>'formal_details','')::jsonb,'{}'::jsonb);

  if target_id is null then
    insert into public.tender_contracts(
      contract_no,quotation_id,contract_type,company_name,client_name,client_representative,
      project_name,site_address,contract_start_date,contract_end_date,contract_months,
      payment_due_day,tax_rate,service_scope,contract_terms,formal_details,status,note
    ) values (
      header->>'contract_no',nullif(header->>'quotation_id','')::uuid,normalized_type,normalized_company,
      header->>'client_name',nullif(header->>'client_representative',''),header->>'project_name',
      nullif(header->>'site_address',''),nullif(header->>'contract_start_date','')::date,
      nullif(header->>'contract_end_date','')::date,coalesce(nullif(header->>'contract_months','')::integer,12),
      coalesce(nullif(header->>'payment_due_day','')::integer,10),coalesce(nullif(header->>'tax_rate','')::numeric,5),
      header->>'service_scope',header->>'contract_terms',normalized_details,
      coalesce(header->>'status','draft'),header->>'note'
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
      contract_terms=header->>'contract_terms',formal_details=normalized_details,
      status=coalesce(header->>'status','draft'),note=header->>'note',updated_at=now()
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

  select coalesce(sum(line_monthly_total),0) into subtotal
  from public.tender_contract_items where contract_id=cid;
  select round(subtotal*tax_rate/100,2) into tax
  from public.tender_contracts where id=cid;
  total := subtotal + tax;
  update public.tender_contracts
  set monthly_subtotal=subtotal,monthly_tax=tax,monthly_total=total,updated_at=now()
  where id=cid;
  return cid;
end $$;

grant execute on function public.save_tender_contract(uuid,jsonb,jsonb) to authenticated;
