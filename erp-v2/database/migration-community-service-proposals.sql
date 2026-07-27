-- 社區綜合服務企劃書：固定版型留在程式端，資料庫僅保存每案可異動內容。
alter table public.numbering_rules drop constraint if exists numbering_rules_target_type_check;
alter table public.numbering_rules add constraint numbering_rules_target_type_check check (target_type in (
  'employee','site','supervisor_inspection','leave_request','bullying_complaint',
  'salary_advance','payroll_record','employment_certificate','termination_certificate','tender_quotation',
  'property_contract','security_contract','vendor','inventory_item',
  'inventory_transaction','inventory_loan','community_billing_claim','community_service_proposal'
));

insert into public.numbering_rules
  (target_type,rule_name,prefix,digits,start_number,last_number,match_job_title,is_default,is_active,sort_order)
values ('community_service_proposal','社區綜合服務企劃書','P-',6,1,0,null,true,true,160)
on conflict (target_type,rule_name) do nothing;

create table if not exists public.community_service_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_no text not null unique,
  quotation_id uuid references public.tender_quotations(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  proposal_date date not null default current_date,
  client_name text not null,
  project_name text not null,
  site_address text not null default '',
  community_phone text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  household_count integer check (household_count is null or household_count >= 0),
  building_count integer check (building_count is null or building_count >= 0),
  service_start_date date,
  staffing jsonb not null default '[]'::jsonb,
  enabled_sections jsonb not null default '["company","staffing","security","operations","digital"]'::jsonb,
  editable_content jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','reviewing','delivered','won','archived')),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_service_proposals_lookup_idx
  on public.community_service_proposals(proposal_date desc, updated_at desc);
create index if not exists community_service_proposals_quote_idx
  on public.community_service_proposals(quotation_id);
create index if not exists community_service_proposals_site_idx
  on public.community_service_proposals(site_id);

alter table public.community_service_proposals enable row level security;
drop policy if exists "authorized staff manage community service proposals" on public.community_service_proposals;
create policy "authorized staff manage community service proposals"
on public.community_service_proposals for all to authenticated
using (
  public.has_feature_permission('serviceProposals')
  or public.has_feature_permission('tenderQuotations')
)
with check (
  public.has_feature_permission('serviceProposals')
  or public.has_feature_permission('tenderQuotations')
);

grant select,insert,update,delete on public.community_service_proposals to authenticated;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'drop trigger if exists community_service_proposals_updated on public.community_service_proposals';
    execute 'create trigger community_service_proposals_updated before update on public.community_service_proposals for each row execute function public.set_updated_at()';
  end if;
  if to_regprocedure('public.write_audit_log()') is not null then
    execute 'drop trigger if exists audit_changes on public.community_service_proposals';
    execute 'create trigger audit_changes after insert or update or delete on public.community_service_proposals for each row execute function public.write_audit_log()';
  end if;
end $$;
