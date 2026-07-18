-- ERP 員工守則管理與員工端同步

create table if not exists public.employee_rules (
  id uuid primary key default gen_random_uuid(),
  section_title text not null,
  content text not null,
  sort_order integer not null default 10,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_rules enable row level security;

drop policy if exists "staff reads active employee rules" on public.employee_rules;
create policy "staff reads active employee rules" on public.employee_rules
for select to authenticated
using (is_active or public.current_user_role() in ('hr','admin'));

drop policy if exists "hr manages employee rules" on public.employee_rules;
create policy "hr manages employee rules" on public.employee_rules
for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

drop trigger if exists employee_rules_updated on public.employee_rules;
create trigger employee_rules_updated before update on public.employee_rules
for each row execute function public.set_updated_at();

insert into public.employee_rules (section_title, content, sort_order)
select seed.section_title, seed.content, seed.sort_order
from (values
  ('一、出勤與排班', E'依班表準時到勤，不得無故遲到、早退、缺勤或自行換班。\n上、下班應依規定完成打卡；打卡異常須立即回報，不得代打卡。\n因故不能出勤時，應儘速通知主管並依系統提出請假申請。\n夜班跨日勤務應確認日期與時段，完成交接後才能離開案場。', 10),
  ('二、執勤與交接', E'執勤期間應保持警覺，不得睡覺、飲酒、賭博、擅離職守或從事與勤務無關之活動。\n依案場規定完成門禁、巡邏、訪客、包裹及異常事件紀錄。\n交接班時應清楚交代未完成事項、鑰匙、設備及重要事件。\n發現事故、治安疑慮、設備異常或住戶緊急狀況，應先維護安全並立即通報。', 20),
  ('三、服裝儀容與服務', E'值勤時應穿著公司規定制服、配戴識別證，保持服裝整潔與儀容端正。\n對住戶、客戶、訪客及同仁應保持禮貌，不得辱罵、挑釁、歧視或騷擾。\n處理爭議時保持冷靜，不與對方發生肢體衝突，必要時回報主管或報警。', 30),
  ('四、保密與個人資料', E'不得洩漏住戶、客戶、案場、公司或同仁之個人資料、門禁資訊及監視器畫面。\n未經授權不得拍攝、下載、轉傳或在社群網站發布勤務內容。\n員工帳號及密碼僅限本人使用，不得交由他人登入。', 40),
  ('五、公司物品與安全', E'公司或案場提供之鑰匙、電腦、投影設備、器材及文件應妥善保管並依規定歸還。\n不得私自挪用、帶離、損壞或交由無關人員使用。\n執勤以自身及現場人員安全為優先；火災、傷病或重大事件應依緊急程序處理並留下紀錄。', 50)
) as seed(section_title, content, sort_order)
where not exists (select 1 from public.employee_rules);

-- 將舊的 10、20、30…自動整理為直覺的 1、2、3…。
with ranked as (
  select id, row_number() over (order by sort_order, created_at, id) as new_order
  from public.employee_rules
)
update public.employee_rules rule
set sort_order = ranked.new_order
from ranked
where rule.id = ranked.id and rule.sort_order <> ranked.new_order;

grant select on public.employee_rules to authenticated;
grant insert, update, delete on public.employee_rules to authenticated;

select 'employee rules management installed' as result;
