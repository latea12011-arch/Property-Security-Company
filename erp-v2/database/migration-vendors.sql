-- 合作廠商名冊與採購入庫來源
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_code text not null unique,
  name text not null,
  category text not null default 'other' check (category in ('security_equipment','uniform','cleaning','repair','fire_safety','electromechanical','staffing','office','other')),
  tax_id text,
  contact_name text,
  contact_phone text,
  contact_email text,
  invoice_email text,
  address text,
  payment_terms text not null default 'net_30' check (payment_terms in ('cash_payment','cod','net_30','net_45','net_60','other')),
  bank_name text,
  bank_account_name text,
  bank_account_last5 text,
  contract_start_date date,
  contract_end_date date,
  service_scope text,
  status public.record_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contract_end_date is null or contract_start_date is null or contract_end_date>=contract_start_date)
);
create unique index if not exists vendors_tax_id_unique on public.vendors(tax_id) where tax_id is not null and tax_id<>'';
create index if not exists vendors_name_idx on public.vendors(name);
create index if not exists vendors_status_category_idx on public.vendors(status,category);

alter table public.inventory_transactions add column if not exists vendor_id uuid references public.vendors(id) on delete restrict;
create index if not exists inventory_transactions_vendor_idx on public.inventory_transactions(vendor_id,transaction_date desc);

drop trigger if exists vendors_updated on public.vendors;
create trigger vendors_updated before update on public.vendors for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;
drop policy if exists "authorized staff read vendors" on public.vendors;
create policy "authorized staff read vendors" on public.vendors for select to authenticated
using (public.has_any_feature(array['vendors','inventoryItems','inventoryTransactions']));
drop policy if exists "authorized staff manage vendors" on public.vendors;
create policy "authorized staff manage vendors" on public.vendors for all to authenticated
using (public.has_feature_permission('vendors')) with check (public.has_feature_permission('vendors'));
grant select,insert,update,delete on public.vendors to authenticated;

do $$ begin
  if to_regprocedure('public.write_audit_log()') is not null then
    execute 'drop trigger if exists audit_changes on public.vendors';
    execute 'create trigger audit_changes after insert or update or delete on public.vendors for each row execute function public.write_audit_log()';
  end if;
end $$;
