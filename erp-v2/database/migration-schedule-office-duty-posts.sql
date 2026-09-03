-- Add office duty posts without changing existing schedules or permissions.
begin;
alter table public.schedules drop constraint if exists schedules_duty_post_check;
alter table public.schedules add constraint schedules_duty_post_check check (
  duty_post is null or duty_post in (
    'chief_manager','secretary','main','control','lane','patrol','secondary',
    'lobby','gate','parking','reception','mobile_support','other'
  )
);
commit;
