-- 管理員可將操作紀錄下載封存至電腦後，清除已封存的雲端資料。
drop policy if exists "admin deletes archived audit logs" on public.audit_logs;
create policy "admin deletes archived audit logs" on public.audit_logs
for delete to authenticated using (public.current_user_role()='admin');
grant delete on public.audit_logs to authenticated;

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
