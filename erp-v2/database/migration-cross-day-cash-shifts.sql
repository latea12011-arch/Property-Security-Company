-- 跨日夜班與現金班（當日領現）
alter table public.employees
  add column if not exists cash_shift_default_amount numeric(12,2) not null default 0 check (cash_shift_default_amount >= 0);

alter table public.schedules
  add column if not exists cash_amount numeric(12,2) not null default 0 check (cash_amount >= 0),
  add column if not exists cash_payment_status text not null default 'none' check (cash_payment_status in ('none','pending','paid')),
  add column if not exists cash_paid_at timestamptz;

alter table public.schedules drop constraint if exists schedules_shift_type_check;
alter table public.schedules add constraint schedules_shift_type_check
  check (shift_type in ('day','night','mobile','special','cash','off','annual','personal','sick','custom'));

create or replace function public.prepare_cash_shift()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.shift_type='cash' then
    if new.cash_amount=0 then
      select cash_shift_default_amount into new.cash_amount from public.employees where id=new.employee_id;
    end if;
    if new.cash_payment_status='none' then new.cash_payment_status='pending'; end if;
  else
    new.cash_amount:=0; new.cash_payment_status:='none'; new.cash_paid_at:=null;
  end if;
  return new;
end; $$;
drop trigger if exists prepare_cash_shift on public.schedules;
create trigger prepare_cash_shift before insert or update on public.schedules
for each row execute function public.prepare_cash_shift();

create or replace function public.protect_paid_cash_shift()
returns trigger language plpgsql as $$
begin
  if old.shift_type='cash' and old.cash_payment_status='paid' then
    raise exception '已完成領現確認的現金班不可刪除或覆蓋';
  end if;
  return old;
end; $$;
drop trigger if exists protect_paid_cash_shift on public.schedules;
create trigger protect_paid_cash_shift before delete on public.schedules
for each row execute function public.protect_paid_cash_shift();

create or replace function public.confirm_cash_shift_payment(target_schedule_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare paid_time timestamptz;
begin
  update public.schedules set cash_payment_status='paid',cash_paid_at=now()
  where id=target_schedule_id and employee_id=public.current_employee_id()
    and shift_type='cash' and cash_payment_status='pending'
  returning cash_paid_at into paid_time;
  if paid_time is null then raise exception '找不到可確認的現金班，或已完成領現確認'; end if;
  return paid_time;
end; $$;
grant execute on function public.confirm_cash_shift_payment(uuid) to authenticated;

create index if not exists schedules_cash_payment_idx on public.schedules(cash_payment_status,work_date) where shift_type='cash';
