-- 社區請款單：保全費、物業費、清潔費與其他服務費。
alter table public.numbering_rules drop constraint if exists numbering_rules_target_type_check;
alter table public.numbering_rules add constraint numbering_rules_target_type_check check (target_type in (
  'employee','site','supervisor_inspection','leave_request','bullying_complaint',
  'salary_advance','payroll_record','employment_certificate','termination_certificate','tender_quotation',
  'property_contract','security_contract','vendor','inventory_item',
  'inventory_transaction','inventory_loan','community_billing_claim'
));

insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,last_number,match_job_title,is_default,is_active,sort_order)
values ('community_billing_claim','社區請款單','CLAIM-',6,1,0,null,true,true,150)
on conflict (target_type,rule_name) do nothing;

create table if not exists public.community_billing_claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text unique,
  numbering_rule_id uuid references public.numbering_rules(id) on delete set null,
  issuer_company text not null default 'security'
    check (issuer_company in ('security','property')),
  site_id uuid references public.sites(id) on delete set null,
  site_code text not null default '',
  community_name text not null default '',
  community_tax_id text not null default '',
  community_phone text not null default '',
  community_address text not null default '',
  billing_month text not null check (billing_month ~ '^[0-9]{4}-[0-9]{2}$'),
  service_period_start date,
  service_period_end date,
  issue_date date not null default current_date,
  due_date date,
  security_fee numeric(14,2) not null default 0 check (security_fee >= 0),
  property_management_fee numeric(14,2) not null default 0 check (property_management_fee >= 0),
  cleaning_fee numeric(14,2) not null default 0 check (cleaning_fee >= 0),
  equipment_fee numeric(14,2) not null default 0 check (equipment_fee >= 0),
  other_fee numeric(14,2) not null default 0 check (other_fee >= 0),
  other_fee_description text,
  tax_mode text not null default 'tax_included'
    check (tax_mode in ('tax_included','tax_excluded','tax_exempt')),
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  payment_bank text,
  payment_account_name text,
  payment_account_no text,
  status text not null default 'draft'
    check (status in ('draft','sent','paid','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_billing_claims_site_month_idx
  on public.community_billing_claims(site_id,billing_month);
create index if not exists community_billing_claims_status_idx
  on public.community_billing_claims(status,issue_date desc);

create or replace function public.prepare_community_billing_claim()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  site_row public.sites%rowtype;
  fee_total numeric(14,2);
begin
  if new.site_id is not null then
    select * into site_row from public.sites where id=new.site_id;
    if not found then raise exception '找不到指定案場'; end if;
    new.site_code := coalesce(site_row.code,'');
    new.community_name := coalesce(site_row.name,'');
    new.community_tax_id := coalesce(site_row.community_tax_id,'');
    new.community_phone := coalesce(site_row.community_phone,'');
    new.community_address := coalesce(site_row.address,'');
  end if;

  fee_total :=
    coalesce(new.security_fee,0) +
    coalesce(new.property_management_fee,0) +
    coalesce(new.cleaning_fee,0) +
    coalesce(new.equipment_fee,0) +
    coalesce(new.other_fee,0);

  if fee_total <= 0 then raise exception '請款金額必須大於 0'; end if;
  if new.service_period_start is not null and new.service_period_end is not null
     and new.service_period_end < new.service_period_start then
    raise exception '服務期間結束日不可早於開始日';
  end if;

  if new.tax_mode = 'tax_excluded' then
    new.subtotal := round(fee_total,2);
    new.tax_amount := round(fee_total * 0.05,2);
    new.total_amount := new.subtotal + new.tax_amount;
  elsif new.tax_mode = 'tax_included' then
    new.total_amount := round(fee_total,2);
    new.subtotal := round(fee_total / 1.05,2);
    new.tax_amount := new.total_amount - new.subtotal;
  else
    new.subtotal := round(fee_total,2);
    new.tax_amount := 0;
    new.total_amount := new.subtotal;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists prepare_community_billing_claim on public.community_billing_claims;
create trigger prepare_community_billing_claim
before insert or update on public.community_billing_claims
for each row execute function public.prepare_community_billing_claim();

drop trigger if exists managed_number_before_save on public.community_billing_claims;
create trigger managed_number_before_save
before insert or update of claim_no on public.community_billing_claims
for each row execute function public.ensure_managed_document_number('community_billing_claim','claim_no');

alter table public.community_billing_claims enable row level security;
drop policy if exists "authorized staff manage community billing claims" on public.community_billing_claims;
create policy "authorized staff manage community billing claims"
on public.community_billing_claims for all to authenticated
using (
  public.has_feature_permission('billingClaims')
  or public.has_feature_permission('payroll')
)
with check (
  public.has_feature_permission('billingClaims')
  or public.has_feature_permission('payroll')
);

grant select,insert,update,delete on public.community_billing_claims to authenticated;
notify pgrst,'reload schema';
select 'community billing claims installed' as status;
