# ERP 壓力測試

靜態入口測試（不寫入資料）：

```powershell
node load-static.mjs https://你的網址/erp-v2/ 1000 50
```

參數依序為網址、總請求數、同時請求數。正式打卡 RPC 不可直接對正式員工壓測；需先建立獨立 Supabase 測試專案，批次建立測試員工、案場、排班及 Auth 帳號後再執行寫入壓測。

Supabase唯讀API測試（使用專案公開 anon key，不寫入資料）：

```powershell
node load-supabase-read.mjs 1000 50
```
