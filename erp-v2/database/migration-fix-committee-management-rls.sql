-- 修正管委會帳號管理：使用 ERP 功能權限，不綁死 profiles.role='admin'
drop policy if exists "committee reads own access" on public.community_committee_access;
create policy "committee reads own access" on public.community_committee_access for select to authenticated
using (
  lower(email)=lower(coalesce(auth.jwt()->>'email',''))
  or public.current_user_role() in ('admin','hr')
  or public.has_feature_permission('committeeManagement')
  or public.has_feature_permission('websiteManager')
);

drop policy if exists "admin manages committee access" on public.community_committee_access;
create policy "admin manages committee access" on public.community_committee_access for all to authenticated
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

select 'committee management RLS fixed' as status;
