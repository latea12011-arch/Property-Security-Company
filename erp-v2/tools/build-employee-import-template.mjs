import fs from 'node:fs/promises';
import path from 'node:path';
const artifactModule = process.env.ARTIFACT_TOOL_MODULE
  || 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const { SpreadsheetFile, Workbook } = await import(artifactModule);

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const outputDir = path.join(repoRoot, 'outputs', 'employee-import-20260729');
const appTemplateDir = path.join(repoRoot, 'erp-v2', 'assets', 'templates');
const outputFile = path.join(outputDir, '紘嘉ERP員工批次匯入範本.xlsx');
const appFile = path.join(appTemplateDir, 'employee-import-template.xlsx');
const headers = [
  '工號*', '姓名*', '初始密碼', '職稱', '身分類別', '系統角色', '在職狀態', '電話',
  '身分證字號', '戶籍地址', '現居地址', '緊急聯絡人', '緊急聯絡人關係', '緊急聯絡電話', '到職日期',
  '勞健保加保日期', '駕照類別', '交通方式', '總幹事證號', '良民證', '體檢報告',
  '健康檢查日期', '標準每日工時', '現金班日薪', '薪資發放方式', '銀行代碼',
  '銀行帳戶', '銀行手續費模式', '基本月薪', '勞保自付額', '健保自付額',
  '團保自付額', '勞退雇主提繳', '薪資生效日期', '可排班案場',
];
const widthByHeader = {
  '工號*': 13, '姓名*': 13, '初始密碼': 15, '職稱': 15, '身分類別': 16, '系統角色': 17,
  '在職狀態': 13, '電話': 16, '身分證字號': 16, '戶籍地址': 28, '現居地址': 28,
  '緊急聯絡人': 15, '緊急聯絡人關係': 15, '緊急聯絡電話': 17, '到職日期': 14, '勞健保加保日期': 16,
  '駕照類別': 20, '交通方式': 15, '總幹事證號': 18, '良民證': 13, '體檢報告': 13,
  '健康檢查日期': 16, '標準每日工時': 15, '現金班日薪': 15, '薪資發放方式': 17,
  '銀行代碼': 13, '銀行帳戶': 20, '銀行手續費模式': 20, '基本月薪': 15,
  '勞保自付額': 15, '健保自付額': 15, '團保自付額': 15, '勞退雇主提繳': 17,
  '薪資生效日期': 16, '可排班案場': 28,
};

const workbook = Workbook.create();
const data = workbook.worksheets.add('員工匯入範本');
const guide = workbook.worksheets.add('填寫說明');
data.showGridLines = false;
guide.showGridLines = false;

data.getRangeByIndexes(0, 0, 1, headers.length).merge();
data.getRange('A1').values = [['紘嘉物業 ERP｜員工資料批次匯入範本']];
data.getRange('A1').format = {
  fill: '#123A5A',
  font: { bold: true, color: '#FFFFFF', size: 18 },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
};
data.getRange('A1').format.rowHeight = 34;
data.getRangeByIndexes(1, 0, 1, headers.length).merge();
data.getRange('A2').values = [['請從第 5 列開始填寫；「工號、姓名」為必填。日期使用 YYYY-MM-DD。初始密碼留空就不建立／變更登入帳號。請勿刪除或更名標題列。']];
data.getRange('A2').format = {
  fill: '#E8F4F1',
  font: { color: '#215A55', size: 11 },
  horizontalAlignment: 'left',
  verticalAlignment: 'center',
  wrapText: true,
};
data.getRange('A2').format.rowHeight = 30;
data.getRangeByIndexes(2, 0, 1, headers.length).merge();
data.getRange('A3').values = [['可一次貼上或填寫多位員工；上傳後 ERP 會先顯示預覽與錯誤，再由您確認批次新增或依工號更新。']];
data.getRange('A3').format = { font: { color: '#66788A', italic: true }, horizontalAlignment: 'left' };
data.getRangeByIndexes(3, 0, 1, headers.length).values = [headers];
data.getRangeByIndexes(3, 0, 1, headers.length).format = {
  fill: '#D9A441',
  font: { bold: true, color: '#102F49' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  wrapText: true,
  borders: { preset: 'all', color: '#B7862E', style: 'thin' },
};
data.getRangeByIndexes(3, 0, 1, headers.length).format.rowHeight = 32;
data.getRangeByIndexes(4, 0, 196, headers.length).format = {
  fill: '#FFFFFF',
  font: { color: '#18384F' },
  verticalAlignment: 'center',
  borders: { preset: 'all', color: '#DCE5EB', style: 'thin' },
};
data.getRangeByIndexes(4, 0, 196, headers.length).format.rowHeight = 23;
headers.forEach((header, index) => {
  data.getRangeByIndexes(0, index, 200, 1).format.columnWidth = widthByHeader[header] || 15;
});
data.freezePanes.freezeRows(4);
data.freezePanes.freezeColumns(2);

const listValidations = [
  [4, ['正職人員', '機動人員', '內部人員', '兼職人員', '現金班人員', '臨時／支援人員']],
  [5, ['員工／保全員', '總幹事／案場主管', '人事／行政', '系統管理員']],
  [6, ['在職', '離職']],
  [16, ['步行', '自行車', '機車', '自用汽車', '大眾運輸', '公司車', '親友接送', '其他']],
  [18, ['未繳交', '已繳交']],
  [19, ['未繳交', '已繳交']],
  [23, ['銀行匯款', '領現']],
  [26, ['本公司銀行', '非本公司銀行']],
];
listValidations.forEach(([column, values]) => {
  data.getRangeByIndexes(4, column, 196, 1).dataValidation = { rule: { type: 'list', values } };
});

guide.getRange('A1:D1').merge();
guide.getRange('A1').values = [['填寫說明與允許選項']];
guide.getRange('A1').format = {
  fill: '#123A5A',
  font: { bold: true, color: '#FFFFFF', size: 17 },
  horizontalAlignment: 'center',
};
const guideRows = [
  ['欄位', '是否必填', '填寫方式／允許值', '範例'],
  ['工號', '必填', '不可重複；若選擇更新模式，會用工號找到既有員工。', 'A006'],
  ['姓名', '必填', '員工中文姓名。', '王大明'],
  ['初始密碼', '選填', '至少 8 碼；留空不建立或變更登入帳號。', 'Hongjia168'],
  ['身分類別', '選填', '正職人員、機動人員、內部人員、兼職人員、現金班人員、臨時／支援人員', '正職人員'],
  ['系統角色', '選填', '員工／保全員、總幹事／案場主管、人事／行政、系統管理員', '員工／保全員'],
  ['日期欄位', '選填', '西元 YYYY-MM-DD；也接受民國年，例如 115/07/29。', '2026-07-29'],
  ['駕照類別', '選填', '最多兩種，以「、」分隔；無駕照填「無」。', '普通重型機車、普通小型車'],
  ['良民證／體檢報告', '選填', '未繳交或已繳交。體檢報告為已繳交時，必須填健康檢查日期。', '已繳交'],
  ['薪資發放方式', '選填', '銀行匯款或領現。', '銀行匯款'],
  ['銀行手續費模式', '選填', '本公司銀行或非本公司銀行。', '本公司銀行'],
  ['可排班案場', '選填', '使用 ERP 案場代碼或完整名稱；多個案場以「、」分隔。', 'SITE-001、美麗歐洲'],
  ['數字欄位', '選填', '請填 0 以上的數字，不要輸入「元」字。', '45000'],
];
guide.getRangeByIndexes(2, 0, guideRows.length, 4).values = guideRows;
guide.getRange('A3:D3').format = {
  fill: '#D9A441',
  font: { bold: true, color: '#102F49' },
  horizontalAlignment: 'center',
  borders: { preset: 'all', color: '#B7862E', style: 'thin' },
};
guide.getRangeByIndexes(3, 0, guideRows.length - 1, 4).format = {
  borders: { preset: 'all', color: '#DCE5EB', style: 'thin' },
  wrapText: true,
  verticalAlignment: 'top',
};
guide.getRange('A:A').format.columnWidth = 22;
guide.getRange('B:B').format.columnWidth = 14;
guide.getRange('C:C').format.columnWidth = 65;
guide.getRange('D:D').format.columnWidth = 26;
guide.getRangeByIndexes(2, 0, guideRows.length, 4).format.rowHeight = 36;
guide.freezePanes.freezeRows(3);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(appTemplateDir, { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputFile);
await fs.copyFile(outputFile, appFile);
const preview = await workbook.render({ sheetName: '填寫說明', autoCrop: 'all', scale: 1, format: 'png' });
await fs.writeFile(path.join(outputDir, 'employee-import-template-preview.png'), new Uint8Array(await preview.arrayBuffer()));
const dataPreview = await workbook.render({ sheetName: '員工匯入範本', range: 'A1:J10', scale: 1, format: 'png' });
await fs.writeFile(path.join(outputDir, 'employee-import-data-preview.png'), new Uint8Array(await dataPreview.arrayBuffer()));
const inspection = await workbook.inspect({ kind: 'sheet,region', range: 'A1:H12', maxChars: 5000, tableMaxRows: 12, tableMaxCols: 8 });
await fs.writeFile(path.join(outputDir, 'inspection.txt'), inspection.ndjson || String(inspection), 'utf8');
console.log(JSON.stringify({ outputFile, appFile, preview: path.join(outputDir, 'employee-import-template-preview.png') }, null, 2));
