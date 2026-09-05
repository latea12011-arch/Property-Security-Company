-- Add cleaning personnel as an employee title and scheduling duty post.
-- employees.job_title is text, so no employee table migration is required.
begin;
alter table public.schedules drop constraint if exists schedules_duty_post_check;
alter table public.schedules add constraint schedules_duty_post_check check (
  duty_post is null or duty_post in (
    'chief_manager','secretary','cleaner','main','control','lane','patrol','secondary',
    'lobby','gate','parking','reception','mobile_support','other'
  )
);
comment on column public.schedules.duty_post is
  '勤務哨別：總幹事、秘書、清潔人員、主哨、中控、車道、巡邏哨、副哨、大廳哨、門禁哨、停車場哨、收發哨、機動支援或其他';
commit;
