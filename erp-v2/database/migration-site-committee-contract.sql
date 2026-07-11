-- 案場管委會、會議與合約管理
alter table public.sites
  add column if not exists chairman_name text,
  add column if not exists chairman_phone text,
  add column if not exists household_count integer check (household_count is null or household_count >= 0),
  add column if not exists committee_term_no integer check (committee_term_no is null or committee_term_no >= 1),
  add column if not exists owners_meeting_date date,
  add column if not exists regular_meeting_schedule text,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists renewal_reminder_days integer not null default 90 check (renewal_reminder_days >= 0),
  add column if not exists renewal_status text not null default 'not_started'
    check (renewal_status in ('not_started','contacting','negotiating','renewed','not_renewing')),
  add column if not exists contract_note text;

alter table public.sites drop constraint if exists sites_contract_dates_check;
alter table public.sites add constraint sites_contract_dates_check
check (contract_end_date is null or contract_start_date is null or contract_end_date >= contract_start_date);

-- 將既有聯絡人資料帶入主委欄位，原資料不會被刪除。
update public.sites
set chairman_name = coalesce(chairman_name, contact_name),
    chairman_phone = coalesce(chairman_phone, contact_phone)
where chairman_name is null or chairman_phone is null;
