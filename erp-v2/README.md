# 紘嘉物業 ERP v2

這是與舊版並存的第二版 PWA。電腦、Android 與 iPhone 使用同一個網址；未設定 Supabase 時可使用本機示範模式。

## 已完成的第一階段

- 響應式 ERP 管理介面
- 員工、案場、勤務排班、出勤、請假六個核心模組
- 本機示範資料的新增、編輯與刪除
- Supabase 電子郵件登入與資料存取介面
- PostgreSQL 資料表、角色與 Row Level Security 權限
- PWA manifest、Service Worker 與加入手機主畫面支援

## 1. 先使用示範模式

使用本機或 GitHub Pages 開啟 `erp-v2/index.html`，按「使用示範模式」。示範資料保存在該瀏覽器的 localStorage，不會同步到其他裝置。

PWA 與 Supabase 必須透過 `https://` 或本機開發伺服器使用，直接雙擊 `file://` 只能預覽介面。

## 2. 建立免費 Supabase

1. 在 Supabase 建立 Free project。
2. 開啟 SQL Editor，完整執行 `database/schema.sql`。
3. 到 Authentication > Users 建立第一位管理員帳號。
4. 複製該使用者 UUID，在 SQL Editor 執行：

```sql
update public.profiles
set role = 'admin', full_name = '系統管理員'
where id = '使用者 UUID';
```

5. 到 Project Settings / API（或 Connect）複製 Project URL 與 Publishable/Anon Key。
6. 填入 `config.js`：

```js
window.ERP_CONFIG = {
  supabaseUrl: 'https://你的專案.supabase.co',
  supabaseAnonKey: '你的 Publishable 或 anon key'
};
```

`anon`／Publishable key 可放在網頁；絕對不要把 `service_role` secret 放進 GitHub 或前端程式。

## 3. 免費發布到 GitHub Pages

目前儲存庫根目錄已是靜態網站。到 GitHub 儲存庫的 Settings > Pages，選擇從 `main` 分支根目錄部署。ERP 網址會是：

```text
https://你的帳號.github.io/Property-Security-Company/erp-v2/
```

## 4. iPhone 安裝

1. 用 Safari 開啟 ERP 網址。
2. 按分享。
3. 選「加入主畫面」。
4. 開啟「以 Web App 打開」後按加入。

Android 使用 Chrome 開啟同一網址，再選「安裝應用程式」或「加到主畫面」。

## 下一階段

- 員工端 GPS 上下班打卡
- 案場指派與主管資料範圍
- QR Code 巡邏點與巡邏紀錄
- 異常事件、照片與交接班
- Excel/PDF 報表與備份流程

## 員工手機端

員工入口：`mobile.html`，使用「工號＋密碼」登入。管理員在 Supabase Authentication 以 `小寫工號@employee.hongjia.local` 建立內部帳號，例如工號 `A001` 使用 `a001@employee.hongjia.local`，並開啟 Auto Confirm。資料庫會依工號自動綁定員工，不需要查看或複製 UID；ERP 員工資料與 Auth 帳號先建立哪一個都可以。既有專案需先執行 `database/migration-auto-link-employee.sql`。

部署 `supabase/functions/create-employee-account` Edge Function 後，行政可直接在 ERP 員工表單填初始密碼，系統會自動建立或更新登入帳號，不再需要進入 Supabase Authentication。目前 Dashboard 部署產生的函式 slug 為 `quick-worker`，ERP 依此 slug 呼叫。
