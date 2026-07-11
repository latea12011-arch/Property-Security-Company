# create-employee-account

受 JWT 與 `profiles.role` 保護的 Edge Function。ERP 管理員或人事建立／編輯員工並填初始密碼時，自動建立工號登入帳號；`SUPABASE_SERVICE_ROLE_KEY` 僅由 Supabase 執行環境使用，不放入前端。

部署時保持 JWT verification 開啟。函式名稱必須是 `create-employee-account`。
