# ERP 備份與還原作業

## 每日

- 確認 Supabase 專案的自動資料庫備份狀態正常。
- 確認員工打卡、薪資、排班與網站通知資料表的健康檢查沒有警告。

## 每月

- 下載資料庫備份並存放於公司管理電腦的加密資料夾，再複製一份到離線硬碟。
- 備份範圍至少包含 `employees`、`sites`、`schedules`、`attendance`、`attendance_punch_receipts`、`leave_requests`、`payroll_records`、`website_submissions`。
- 匯出後確認檔案能開啟，並記錄備份日期、執行人與檔案雜湊值。

## 每季還原演練

- 僅在測試專案還原，禁止直接覆蓋正式環境。
- 抽查一名員工的班表、跨日打卡、請假、薪資單與現金班領取資料。
- 測試完成後記錄結果；若失敗，先修正備份流程再結案。

## 災難復原順序

1. 暫停後台寫入與排班修改。
2. 建立新的 Supabase 測試專案並還原最近備份。
3. 執行所有 `database/migration-*.sql` 更新。
4. 完成健康檢查及打卡隔離測試後，才切換正式連線。

打卡寫入壓力測試必須使用隔離測試專案，執行 `tests/load-attendance-write.mjs`；腳本會拒絕正式專案網址。
