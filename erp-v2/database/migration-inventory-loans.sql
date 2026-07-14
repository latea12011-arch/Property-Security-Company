-- 公司設備借用、歸還與可借數量控管
create table if not exists public.inventory_loans (
  id uuid primary key default gen_random_uuid(),
  document_no text not null unique,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  loan_date date not null default current_date,
  expected_return_date date not null,
  returned_date date,
  purpose text not null,
  condition_out text not null default 'good' check (condition_out in ('good','used','damaged')),
  condition_in text check (condition_in in ('good','used','damaged')),
  status text not null default 'borrowed' check (status in ('borrowed','returned','lost','damaged')),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  returned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_return_date >= loan_date),
  check (status <> 'returned' or returned_date is not null)
);

create index if not exists inventory_loans_employee_status_idx
  on public.inventory_loans(employee_id,status,expected_return_date);
create index if not exists inventory_loans_item_status_idx
  on public.inventory_loans(item_id,status,expected_return_date);

create or replace function public.validate_inventory_loan_availability()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  total_stock numeric;
  unavailable numeric;
begin
  select current_stock into total_stock
  from public.inventory_items where id=new.item_id for update;
  if total_stock is null then raise exception '找不到借用物品'; end if;

  if new.status in ('borrowed','lost','damaged') then
    select coalesce(sum(quantity),0) into unavailable
    from public.inventory_loans
    where item_id=new.item_id
      and status in ('borrowed','lost','damaged')
      and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);
    if unavailable+new.quantity > total_stock then
      raise exception '可借數量不足：總庫存 %，目前不可借 %，本次申請 %',total_stock,unavailable,new.quantity;
    end if;
  end if;
  new.updated_at:=now();
  if new.status='returned' and new.returned_by is null then new.returned_by:=auth.uid(); end if;
  return new;
end; $$;

drop trigger if exists validate_inventory_loan_availability on public.inventory_loans;
create trigger validate_inventory_loan_availability
before insert or update on public.inventory_loans
for each row execute function public.validate_inventory_loan_availability();

create or replace function public.apply_inventory_stock_delta(target_item_id uuid, stock_delta numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.inventory_items item
  set current_stock=item.current_stock+stock_delta
  where item.id=target_item_id
    and item.current_stock+stock_delta >= coalesce((
      select sum(loan.quantity) from public.inventory_loans loan
      where loan.item_id=item.id and loan.status in ('borrowed','lost','damaged')
    ),0);
  if not found then raise exception '庫存不足或已有設備借出，無法完成異動'; end if;
end; $$;

create or replace function public.sync_inventory_stock()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.apply_inventory_stock_delta(old.item_id,-public.inventory_delta(old.transaction_type,old.quantity));
    return old;
  end if;
  if tg_op='UPDATE' then
    perform public.apply_inventory_stock_delta(old.item_id,-public.inventory_delta(old.transaction_type,old.quantity));
  end if;
  perform public.apply_inventory_stock_delta(new.item_id,public.inventory_delta(new.transaction_type,new.quantity));
  return new;
end; $$;

create or replace function public.prevent_employee_deactivation_with_loans()
returns trigger language plpgsql security definer set search_path=public as $$
declare outstanding_count integer;
begin
  if old.status='active' and new.status='inactive' then
    select count(*) into outstanding_count from public.inventory_loans
    where employee_id=new.id and status in ('borrowed','lost','damaged');
    if outstanding_count>0 then
      raise exception '此員工仍有 % 筆設備尚未完成歸還或結案，不能停用',outstanding_count;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists prevent_employee_deactivation_with_loans on public.employees;
create trigger prevent_employee_deactivation_with_loans
before update of status on public.employees
for each row execute function public.prevent_employee_deactivation_with_loans();

alter table public.inventory_loans enable row level security;
drop policy if exists "authorized staff read inventory loans" on public.inventory_loans;
create policy "authorized staff read inventory loans" on public.inventory_loans
for select to authenticated using (public.has_any_feature(array['inventoryItems','inventoryTransactions','inventoryLoans']));
drop policy if exists "authorized staff manage inventory loans" on public.inventory_loans;
create policy "authorized staff manage inventory loans" on public.inventory_loans
for all to authenticated using (public.has_feature_permission('inventoryLoans'))
with check (public.has_feature_permission('inventoryLoans'));

drop policy if exists "staff reads inventory items" on public.inventory_items;
create policy "staff reads inventory items" on public.inventory_items for select to authenticated
using (public.has_any_feature(array['inventoryItems','inventoryTransactions','inventoryLoans']));

drop policy if exists "staff reads permitted employees" on public.employees;
create policy "staff reads permitted employees" on public.employees for select to authenticated
using (id=public.current_employee_id() or public.has_any_feature(array['employees','schedules','attendance','leaves','payrollProfiles','advances','payroll','terminations','inventoryTransactions','inventoryLoans']));

drop trigger if exists inventory_loans_updated on public.inventory_loans;
create trigger inventory_loans_updated before update on public.inventory_loans
for each row execute function public.set_updated_at();
drop trigger if exists audit_changes on public.inventory_loans;
create trigger audit_changes after insert or update or delete on public.inventory_loans
for each row execute function public.write_audit_log();

grant select,insert,update,delete on public.inventory_loans to authenticated;
grant execute on function public.apply_inventory_stock_delta(uuid,numeric) to authenticated;
