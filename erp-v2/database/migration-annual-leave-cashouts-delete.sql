-- 特休換薪申請單：允許具有 annualLeaveCashouts 功能權限的人員刪除紀錄。
-- 資料表的既有 RLS policy 仍會限制只有該功能的授權人員可以操作。
grant delete on public.annual_leave_cashouts to authenticated;
notify pgrst,'reload schema';
select 'annual leave cashout delete enabled' as status;
