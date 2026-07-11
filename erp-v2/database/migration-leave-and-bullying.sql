-- 請假時數、特休餘額、證明文件與反霸凌申訴

alter table public.employees
  add column if not exists annual_leave_hours numeric(7,2) not null default 0
  check (annual_leave_hours >= 0);

alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check;
alter table public.leave_requests
  add constraint leave_requests_leave_type_check
  check (leave_type in ('annual','personal','sick','official','marriage','bereavement','maternity','paternity','menstrual','occupational','compensatory','unpaid','other'));
alter table public.leave_requests
  add column if not exists leave_hours numeric(7,2) not null default 8 check (leave_hours > 0),
  add column if not exists proof_path text,
  add column if not exists review_note text;

create table if not exists public.bullying_complaints (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  incident_date date not null,
  incident_location text,
  accused_name text,
  description text not null,
  requested_action text,
  evidence_path text,
  status text not null default 'submitted' check (status in ('submitted','processing','resolved','closed')),
  handler_note text,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bullying_complaints_updated on public.bullying_complaints;
create trigger bullying_complaints_updated before update on public.bullying_complaints
for each row execute function public.set_updated_at();

alter table public.bullying_complaints enable row level security;
drop policy if exists "employees submit own bullying complaints" on public.bullying_complaints;
create policy "employees submit own bullying complaints" on public.bullying_complaints
for insert to authenticated with check (employee_id = public.current_employee_id());
drop policy if exists "employees read own bullying complaints" on public.bullying_complaints;
create policy "employees read own bullying complaints" on public.bullying_complaints
for select to authenticated using (employee_id = public.current_employee_id() or public.current_user_role() in ('hr','admin'));
drop policy if exists "hr handles bullying complaints" on public.bullying_complaints;
create policy "hr handles bullying complaints" on public.bullying_complaints
for update to authenticated using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));
grant select,insert,update on public.bullying_complaints to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hr-private','hr-private',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,
allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

drop policy if exists "staff uploads own hr files" on storage.objects;
create policy "staff uploads own hr files" on storage.objects for insert to authenticated
with check (bucket_id='hr-private' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "staff reads own hr files" on storage.objects;
create policy "staff reads own hr files" on storage.objects for select to authenticated
using (bucket_id='hr-private' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role() in ('hr','admin')));
drop policy if exists "hr manages hr files" on storage.objects;
create policy "hr manages hr files" on storage.objects for all to authenticated
using (bucket_id='hr-private' and public.current_user_role() in ('hr','admin'))
with check (bucket_id='hr-private' and public.current_user_role() in ('hr','admin'));

-- 核准特休時由資料庫自動扣除餘額；取消核准時自動退回。
create or replace function public.sync_annual_leave_balance()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.leave_type='annual' and new.status='approved' and old.status is distinct from 'approved' then
    update public.employees set annual_leave_hours=annual_leave_hours-new.leave_hours
    where id=new.employee_id and annual_leave_hours>=new.leave_hours;
    if not found then raise exception '特休餘額不足'; end if;
  elsif old.leave_type='annual' and old.status='approved'
    and (new.status is distinct from 'approved' or new.leave_type is distinct from 'annual') then
    update public.employees set annual_leave_hours=annual_leave_hours+old.leave_hours where id=old.employee_id;
  end if;
  return new;
end; $$;
drop trigger if exists sync_annual_leave_balance on public.leave_requests;
create trigger sync_annual_leave_balance before update on public.leave_requests
for each row execute function public.sync_annual_leave_balance();
