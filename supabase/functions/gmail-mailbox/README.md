# Gmail mailbox Edge Function

此函式讓 ERP 系統管理員以 `hongjia_prse@gmail.com` 讀取收件匣、開啟郵件、標示已讀並在原討論串回覆。

部署前須在 Supabase Edge Function Secrets 設定：

- `GMAIL_ACCOUNT=hongjia_prse@gmail.com`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

Google OAuth 必須由 `hongjia_prse@gmail.com` 授權，並包含 `https://www.googleapis.com/auth/gmail.modify` 範圍及離線存取，以取得 refresh token。Gmail 密碼與 OAuth 憑證不得寫入前端或提交到 Git。
