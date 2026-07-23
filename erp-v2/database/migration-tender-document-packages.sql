-- 投標文件確認表、外標封、證件封及標單封
create table if not exists public.tender_document_packages (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid unique references public.tender_quotations(id) on delete set null,
  package_no text,
  bid_no text,
  client_name text,
  project_name text not null,
  recipient_name text not null,
  recipient_address text,
  deadline_date date,
  deadline_time time,
  delivery_method text not null default 'personal'
    check (delivery_method in ('personal','postal')),
  sender_name text not null default '紘嘉保全股份有限公司／紘嘉公寓大廈管理維護股份有限公司',
  sender_address text not null default '334 桃園市八德區高城路23號1樓',
  sender_phone text not null default '03-283-0453',
  sender_tax_id text not null default '94012985',
  envelope_no text,
  checklist jsonb not null default '[]'::jsonb,
  prepared_by text,
  prepared_date date,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tender_document_packages_deadline_idx
  on public.tender_document_packages(deadline_date, updated_at desc);

alter table public.tender_document_packages enable row level security;
drop policy if exists "authorized staff manage tender document packages" on public.tender_document_packages;
create policy "authorized staff manage tender document packages"
on public.tender_document_packages for all to authenticated
using (public.has_feature_permission('tenderQuotations'))
with check (public.has_feature_permission('tenderQuotations'));

grant select,insert,update,delete on public.tender_document_packages to authenticated;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'drop trigger if exists tender_document_packages_updated on public.tender_document_packages';
    execute 'create trigger tender_document_packages_updated before update on public.tender_document_packages for each row execute function public.set_updated_at()';
  end if;
  if to_regprocedure('public.write_audit_log()') is not null then
    execute 'drop trigger if exists audit_changes on public.tender_document_packages';
    execute 'create trigger audit_changes after insert or update or delete on public.tender_document_packages for each row execute function public.write_audit_log()';
  end if;
end $$;

