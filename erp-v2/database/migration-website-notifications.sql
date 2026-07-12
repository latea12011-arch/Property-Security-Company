-- 公司網站表單同步至 ERP 通知中心。
create table if not exists public.website_submissions(
  id uuid primary key default gen_random_uuid(),
  submission_type text not null check(submission_type in ('recruitment','customer_service')),
  sender_name text not null,
  sender_phone text not null,
  sender_email text,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check(status in ('new','processing','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.website_submissions enable row level security;
drop policy if exists "website may submit forms" on public.website_submissions;
create policy "website may submit forms" on public.website_submissions for insert to anon with check(status='new');
drop policy if exists "admin reads website submissions" on public.website_submissions;
create policy "admin reads website submissions" on public.website_submissions for select to authenticated using(public.current_user_role() in ('admin','hr'));
drop policy if exists "admin updates website submissions" on public.website_submissions;
create policy "admin updates website submissions" on public.website_submissions for update to authenticated using(public.current_user_role() in ('admin','hr')) with check(public.current_user_role() in ('admin','hr'));
grant insert on public.website_submissions to anon;
grant select,update on public.website_submissions to authenticated;
create index if not exists website_submissions_created_idx on public.website_submissions(created_at desc);
