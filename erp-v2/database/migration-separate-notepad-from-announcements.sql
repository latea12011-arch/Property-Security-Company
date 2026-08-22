-- ERP 記事本與行事曆是內部資料，不得送到員工端作為公司公告。
create or replace function public.queue_announcement_app_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare should_queue boolean := false;
begin
  if tg_op='INSERT' then
    should_queue := new.is_active;
  else
    should_queue := new.is_active and (
      old.is_active is distinct from new.is_active
      or old.content is distinct from new.content
    );
  end if;

  if should_queue and new.publisher not in ('ERP_CALENDAR','ERP_NOTEPAD') then
    insert into public.app_notifications(
      recipient_user_id,notification_type,title,body,target_url,entity_type,entity_id
    )
    select e.user_id,'announcement','公司新公告',left(new.content,180),
      './mobile.html?tab=homeTab','announcement',
      new.id::text||':'||extract(epoch from new.published_at)::bigint::text
    from public.employees e
    where e.user_id is not null and e.status='active'
    on conflict do nothing;
  end if;
  return new;
end $$;

-- 移除過去誤把記事本／行事曆排入的通知。
delete from public.app_notifications
where notification_type='announcement'
  and body ~ '^\\s*\\{'
  and (body like '%"updated_at"%' or body like '%"event_date"%');
