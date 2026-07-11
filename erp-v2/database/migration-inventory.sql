-- 庫存物品、員工／案場領用與庫存異動
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  item_name text not null,
  category text not null default 'other' check (category in ('uniform','equipment','traffic','office','cleaning','other')),
  specification text,
  size text,
  unit text not null default '個',
  current_stock numeric(12,2) not null default 0 check (current_stock >= 0),
  minimum_stock numeric(12,2) not null default 0 check (minimum_stock >= 0),
  storage_location text,
  status public.record_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('purchase','issue','return','adjust_in','adjust_out')),
  quantity numeric(12,2) not null check (quantity > 0),
  employee_id uuid references public.employees(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  transaction_date date not null default current_date,
  purpose text,
  receiver_name text,
  document_no text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (employee_id is not null and site_id is not null))
);

create or replace function public.inventory_delta(kind text, qty numeric)
returns numeric language sql immutable as $$
  select case when kind in ('purchase','return','adjust_in') then qty else -qty end;
$$;

create or replace function public.sync_inventory_stock()
returns trigger language plpgsql security definer set search_path=public as $$
declare delta numeric;
begin
  if tg_op='DELETE' then
    delta := -public.inventory_delta(old.transaction_type,old.quantity);
    update public.inventory_items set current_stock=current_stock+delta where id=old.item_id and current_stock+delta>=0;
    if not found then raise exception '刪除此紀錄後庫存會小於零'; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    delta := -public.inventory_delta(old.transaction_type,old.quantity);
    update public.inventory_items set current_stock=current_stock+delta where id=old.item_id and current_stock+delta>=0;
    if not found then raise exception '原庫存紀錄無法回復'; end if;
  end if;
  delta := public.inventory_delta(new.transaction_type,new.quantity);
  update public.inventory_items set current_stock=current_stock+delta where id=new.item_id and current_stock+delta>=0;
  if not found then raise exception '庫存不足，無法領出或扣減'; end if;
  return new;
end; $$;

drop trigger if exists inventory_items_updated on public.inventory_items;
create trigger inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();
drop trigger if exists inventory_transactions_updated on public.inventory_transactions;
create trigger inventory_transactions_updated before update on public.inventory_transactions for each row execute function public.set_updated_at();
drop trigger if exists sync_inventory_stock on public.inventory_transactions;
create trigger sync_inventory_stock before insert or update or delete on public.inventory_transactions for each row execute function public.sync_inventory_stock();

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
drop policy if exists "staff reads inventory items" on public.inventory_items;
create policy "staff reads inventory items" on public.inventory_items for select to authenticated using (true);
drop policy if exists "hr manages inventory items" on public.inventory_items;
create policy "hr manages inventory items" on public.inventory_items for all to authenticated using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));
drop policy if exists "managers read inventory transactions" on public.inventory_transactions;
create policy "managers read inventory transactions" on public.inventory_transactions for select to authenticated using (public.current_user_role() in ('hr','site_manager','admin'));
drop policy if exists "managers manage inventory transactions" on public.inventory_transactions;
create policy "managers manage inventory transactions" on public.inventory_transactions for all to authenticated using (public.current_user_role() in ('hr','site_manager','admin')) with check (public.current_user_role() in ('hr','site_manager','admin'));
grant select,insert,update,delete on public.inventory_items,public.inventory_transactions to authenticated;
