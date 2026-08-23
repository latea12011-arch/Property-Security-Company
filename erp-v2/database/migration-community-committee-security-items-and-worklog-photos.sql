-- 管委會建議／提醒、工作日誌照片與社區隔離權限
alter table public.community_work_logs
  add column if not exists attachment_path text;

create table if not exists public.community_committee_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  access_id uuid not null references public.community_committee_access(id) on delete cascade,
  item_type text not null default 'suggestion'
    check (item_type in ('suggestion','reminder')),
  title text not null,
  content text not null,
  status text not null default 'new'
    check (status in ('new','processing','completed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_committee_items_site_created_idx
  on public.community_committee_items(site_id,created_at desc);
create index if not exists community_committee_items_access_idx
  on public.community_committee_items(access_id);

alter table public.community_committee_items enable row level security;

drop policy if exists "committee reads own items" on public.community_committee_items;
create policy "committee reads own items"
on public.community_committee_items for select to authenticated
using (
  exists (
    select 1 from public.community_committee_access a
    where a.id=access_id and a.site_id=site_id and a.is_active
      and lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))
  )
  or public.current_user_role() in ('admin','hr')
  or public.has_feature_permission('committeeManagement')
  or public.has_feature_permission('websiteManager')
);

drop policy if exists "committee creates own items" on public.community_committee_items;
create policy "committee creates own items"
on public.community_committee_items for insert to authenticated
with check (
  exists (
    select 1 from public.community_committee_access a
    where a.id=access_id and a.site_id=site_id and a.is_active
      and lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "erp manages committee items" on public.community_committee_items;
create policy "erp manages committee items"
on public.community_committee_items for all to authenticated
using (
  public.current_user_role() in ('admin','hr')
  or public.has_feature_permission('committeeManagement')
  or public.has_feature_permission('websiteManager')
)
with check (
  public.current_user_role() in ('admin','hr')
  or public.has_feature_permission('committeeManagement')
  or public.has_feature_permission('websiteManager')
);

grant select,insert,update,delete on public.community_committee_items to authenticated;

drop trigger if exists community_committee_items_updated on public.community_committee_items;
create trigger community_committee_items_updated
before update on public.community_committee_items
for each row execute function public.set_updated_at();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'community-work-log-media',
  'community-work-log-media',
  false,
  10485760,
  array['image/jpeg','image/png']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "staff uploads own work log photos" on storage.objects;
create policy "staff uploads own work log photos"
on storage.objects for insert to authenticated
with check (
  bucket_id='community-work-log-media'
  and (storage.foldername(name))[1]=public.current_employee_id()::text
);

drop policy if exists "staff reads own work log photos" on storage.objects;
create policy "staff reads own work log photos"
on storage.objects for select to authenticated
using (
  bucket_id='community-work-log-media'
  and (
    (storage.foldername(name))[1]=public.current_employee_id()::text
    or public.current_user_role() in ('admin','hr','site_manager')
    or public.has_feature_permission('workLogReview')
    or exists (
      select 1 from public.community_work_logs w
      where w.attachment_path=storage.objects.name
        and w.visible_to_committee
        and public.current_committee_has_site(w.site_id)
    )
  )
);

drop policy if exists "staff deletes own work log photos" on storage.objects;
create policy "staff deletes own work log photos"
on storage.objects for delete to authenticated
using (
  bucket_id='community-work-log-media'
  and (
    (storage.foldername(name))[1]=public.current_employee_id()::text
    or public.current_user_role() in ('admin','hr')
    or public.has_feature_permission('workLogReview')
  )
);

select 'committee items and work-log photos installed' as status;
