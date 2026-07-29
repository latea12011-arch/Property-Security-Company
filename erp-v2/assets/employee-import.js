(() => {
  'use strict';

  const TEMPLATE_URL = 'assets/templates/employee-import-template.xlsx';
  const HEADER_ALIASES = {
    employee_no: ['工號', '員工編號'],
    full_name: ['姓名', '員工姓名'],
    initial_password: ['初始密碼', '登入密碼'],
    job_title: ['職稱', '職位'],
    employment_type: ['身分類別', '任用類別'],
    role: ['系統角色', 'ERP角色'],
    status: ['在職狀態', '狀態'],
    phone: ['電話', '聯絡電話'],
    national_id: ['身分證字號', '身分證號'],
    registered_address: ['戶籍地址', '戶籍地'],
    residential_address: ['現居地址', '現居地'],
    emergency_contact_name: ['緊急聯絡人'],
    emergency_contact_phone: ['緊急聯絡電話'],
    hire_date: ['到職日期'],
    labor_health_insurance_enroll_date: ['勞健保加保日期', '加保日期'],
    driver_license_type: ['駕照類別', '駕照'],
    transportation_method: ['交通方式'],
    chief_manager_certificate_no: ['總幹事證號'],
    police_clearance_status: ['良民證', '良民證繳交'],
    medical_exam_status: ['體檢報告', '健康檢查報告'],
    medical_exam_date: ['健康檢查日期', '體檢日期'],
    standard_daily_hours: ['標準每日工時', '每日工時'],
    cash_shift_default_amount: ['現金班日薪', '現金班金額'],
    salary_payment_method: ['薪資發放方式', '薪資方式'],
    bank_code: ['銀行代碼', '銀行類別'],
    bank_account_no: ['銀行帳戶', '銀行帳號'],
    bank_fee_mode: ['銀行手續費模式', '手續費模式'],
    payroll_basic_salary: ['基本月薪', '總薪資'],
    payroll_labor_insurance: ['勞保自付額'],
    payroll_health_insurance: ['健保自付額'],
    payroll_group_insurance: ['團保自付額'],
    payroll_pension_contribution: ['勞退雇主提繳', '勞退提繳'],
    payroll_effective_date: ['薪資生效日期'],
    assigned_sites: ['可排班案場', '案場'],
  };
  const employeeTypeMap = mapPairs({
    full_time: ['正職人員', '正職', 'full_time'],
    mobile: ['機動人員', '機動', 'mobile'],
    internal: ['內部人員', '內勤人員', 'internal'],
    part_time: ['兼職人員', '兼職', 'part_time'],
    cash_shift: ['現金班人員', '現金班', 'cash_shift'],
    temporary: ['臨時／支援人員', '臨時/支援人員', '臨時人員', '支援人員', 'temporary'],
  });
  const roleMap = mapPairs({
    guard: ['員工／保全員', '員工/保全員', '保全員', '員工', 'guard'],
    site_manager: ['總幹事／案場主管', '總幹事/案場主管', '總幹事', '案場主管', 'site_manager'],
    hr: ['人事／行政', '人事/行政', '人事', '行政', 'hr'],
    admin: ['系統管理員', '管理員', 'admin'],
  });
  const statusMap = mapPairs({ active: ['在職', '啟用', 'active'], inactive: ['離職', '停用', 'inactive'] });
  const paymentMap = mapPairs({ bank_transfer: ['銀行匯款', '匯款', 'bank_transfer'], cash: ['領現', '現金', 'cash'] });
  const feeMap = mapPairs({
    company_bank: ['本公司銀行', '手續費0元', 'company_bank'],
    other_bank_employee: ['非本公司銀行', '員工負擔手續費', 'other_bank_employee'],
  });
  const submittedMap = mapPairs({
    submitted: ['已繳交', '有', '是', 'submitted'],
    not_submitted: ['未繳交', '無', '否', 'not_submitted'],
  });
  const transportationMap = mapPairs({
    walk: ['步行', 'walk'],
    bicycle: ['自行車', 'bicycle'],
    motorcycle: ['機車', 'motorcycle'],
    car: ['自用汽車', '汽車', 'car'],
    public_transport: ['大眾運輸', 'public_transport'],
    company_vehicle: ['公司車', 'company_vehicle'],
    family_pickup: ['親友接送', 'family_pickup'],
    other: ['其他', 'other'],
  });
  const licenseMap = mapPairs({
    none: ['無', 'none'],
    light_motorcycle: ['輕型機車', 'light_motorcycle'],
    heavy_motorcycle: ['普通重型機車', '重型機車', 'heavy_motorcycle'],
    large_heavy_motorcycle: ['大型重型機車', 'large_heavy_motorcycle'],
    ordinary_car: ['普通小型車', '汽車', 'ordinary_car'],
    professional_car: ['職業小型車', 'professional_car'],
    ordinary_truck: ['普通大貨車', 'ordinary_truck'],
    professional_truck: ['職業大貨車', 'professional_truck'],
    ordinary_bus: ['普通大客車', 'ordinary_bus'],
    professional_bus: ['職業大客車', 'professional_bus'],
    trailer: ['聯結車', 'trailer'],
    multiple_other: ['其他', 'multiple_other'],
  });
  const numericFields = ['standard_daily_hours', 'cash_shift_default_amount', 'payroll_basic_salary', 'payroll_labor_insurance', 'payroll_health_insurance', 'payroll_group_insurance', 'payroll_pension_contribution'];
  const payrollFields = ['payroll_basic_salary', 'payroll_labor_insurance', 'payroll_health_insurance', 'payroll_group_insurance', 'payroll_pension_contribution', 'payroll_effective_date'];
  let ctx = null;
  let parsedRows = [];
  let resultRows = [];

  function mapPairs(groups) {
    const result = new Map();
    Object.entries(groups).forEach(([value, labels]) => labels.forEach(label => result.set(normalize(label), value)));
    return result;
  }
  function normalize(value) {
    return String(value ?? '').trim().toLocaleLowerCase('zh-TW').replace(/\s+/g, '').replace(/[＊*]/g, '');
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function mapped(value, map, fallback, field, errors) {
    if (String(value ?? '').trim() === '') return fallback;
    const found = map.get(normalize(value));
    if (!found) errors.push(`${field}「${value}」不在允許選項內`);
    return found || fallback;
  }
  function numberValue(value, field, errors, fallback) {
    if (String(value ?? '').trim() === '') return fallback;
    const number = Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(number) || number < 0) errors.push(`${field}必須是 0 以上的數字`);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }
  function dateValue(value, field, errors) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const match = text.match(/^(\d{2,4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})日?$/);
    if (!match) {
      errors.push(`${field}請使用 YYYY-MM-DD（民國年也可）`);
      return null;
    }
    let year = Number(match[1]);
    if (year < 1911) year += 1911;
    const month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
      errors.push(`${field}不是有效日期`);
      return null;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function splitValues(value) {
    return String(value ?? '').split(/[、,，;；|/]+/).map(item => item.trim()).filter(Boolean);
  }
  function parseLicenses(value, errors) {
    if (!String(value ?? '').trim()) return 'none';
    const values = splitValues(value).map(item => licenseMap.get(normalize(item))).filter(Boolean);
    if (!values.length) errors.push(`駕照類別「${value}」無法辨識`);
    if (values.length > 2) errors.push('駕照類別最多填寫兩種');
    if (values.includes('none') && values.length > 1) errors.push('駕照類別「無」不可與其他駕照同時填寫');
    return [...new Set(values)].slice(0, 2).join(',') || 'none';
  }
  function findHeaderMap(matrix) {
    for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const map = {};
      row.forEach((value, columnIndex) => {
        const key = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.some(alias => normalize(alias) === normalize(value)))?.[0];
        if (key && map[key] == null) map[key] = columnIndex;
      });
      if (map.employee_no != null && map.full_name != null) return { rowIndex, map };
    }
    throw new Error('找不到「工號」與「姓名」標題列，請使用 ERP 提供的範本。');
  }
  function rawByKey(row, headerMap, key) {
    const index = headerMap[key];
    return index == null ? '' : row[index] ?? '';
  }
  function parseSites(value, errors) {
    const tokens = splitValues(value);
    if (!tokens.length) return [];
    const sites = ctx.sites();
    const result = [];
    tokens.forEach(token => {
      const normalized = normalize(token);
      const site = sites.find(item => normalize(item.code) === normalized || normalize(item.name) === normalized);
      if (!site) errors.push(`找不到案場「${token}」`);
      else if (!result.includes(site.id)) result.push(site.id);
    });
    return result;
  }
  function parseMatrix(matrix) {
    const { rowIndex, map } = findHeaderMap(matrix);
    const existing = new Map(ctx.employees().map(item => [normalize(item.employee_no), item]));
    const seen = new Set();
    const records = [];
    matrix.slice(rowIndex + 1).forEach((row, offset) => {
      if (!row || row.every(value => String(value ?? '').trim() === '')) return;
      const rowNo = rowIndex + offset + 2;
      const errors = [];
      const get = key => String(rawByKey(row, map, key) ?? '').trim();
      const employeeNo = get('employee_no').toUpperCase();
      const fullName = get('full_name');
      if (!employeeNo) errors.push('工號為必填');
      if (!fullName) errors.push('姓名為必填');
      if (employeeNo && seen.has(normalize(employeeNo))) errors.push('檔案內工號重複');
      seen.add(normalize(employeeNo));
      const password = get('initial_password');
      if (password && password.length < 8) errors.push('初始密碼至少 8 碼');
      const medicalStatus = mapped(get('medical_exam_status'), submittedMap, 'not_submitted', '體檢報告', errors);
      const medicalDate = dateValue(get('medical_exam_date'), '健康檢查日期', errors);
      if (medicalStatus === 'submitted' && !medicalDate) errors.push('體檢報告為已繳交時，必須填健康檢查日期');
      const assignedSitesProvided = map.assigned_sites != null && get('assigned_sites') !== '';
      const providedEmployeeFields = new Set(Object.keys(HEADER_ALIASES).filter(key =>
        !['initial_password', 'assigned_sites', ...payrollFields].includes(key)
        && map[key] != null
        && get(key) !== ''
      ));
      providedEmployeeFields.add('employee_no');
      providedEmployeeFields.add('full_name');
      const record = {
        employee_no: employeeNo,
        full_name: fullName,
        job_title: get('job_title') || '保全員',
        employment_type: mapped(get('employment_type'), employeeTypeMap, 'full_time', '身分類別', errors),
        role: mapped(get('role'), roleMap, 'guard', '系統角色', errors),
        status: mapped(get('status'), statusMap, 'active', '在職狀態', errors),
        phone: get('phone') || null,
        national_id: get('national_id').toUpperCase() || null,
        registered_address: get('registered_address') || null,
        residential_address: get('residential_address') || null,
        emergency_contact_name: get('emergency_contact_name') || null,
        emergency_contact_phone: get('emergency_contact_phone') || null,
        hire_date: dateValue(get('hire_date'), '到職日期', errors),
        labor_health_insurance_enroll_date: dateValue(get('labor_health_insurance_enroll_date'), '勞健保加保日期', errors),
        driver_license_type: parseLicenses(get('driver_license_type'), errors),
        transportation_method: mapped(get('transportation_method'), transportationMap, null, '交通方式', errors),
        chief_manager_certificate_no: get('chief_manager_certificate_no') || null,
        police_clearance_status: mapped(get('police_clearance_status'), submittedMap, 'not_submitted', '良民證', errors),
        medical_exam_status: medicalStatus,
        medical_exam_date: medicalDate,
        standard_daily_hours: numberValue(get('standard_daily_hours'), '標準每日工時', errors, 8),
        cash_shift_default_amount: numberValue(get('cash_shift_default_amount'), '現金班日薪', errors, 0),
        salary_payment_method: mapped(get('salary_payment_method'), paymentMap, 'bank_transfer', '薪資發放方式', errors),
        bank_code: get('bank_code') || null,
        bank_account_no: get('bank_account_no') || null,
        bank_fee_mode: mapped(get('bank_fee_mode'), feeMap, 'company_bank', '銀行手續費模式', errors),
      };
      if (password && record.status !== 'active') errors.push('有填初始密碼時，在職狀態必須為「在職」');
      const payroll = {
        basic_salary: numberValue(get('payroll_basic_salary'), '基本月薪', errors, 0),
        labor_insurance: numberValue(get('payroll_labor_insurance'), '勞保自付額', errors, 0),
        health_insurance: numberValue(get('payroll_health_insurance'), '健保自付額', errors, 0),
        group_insurance: numberValue(get('payroll_group_insurance'), '團保自付額', errors, 0),
        pension_contribution: numberValue(get('payroll_pension_contribution'), '勞退雇主提繳', errors, 0),
        effective_date: dateValue(get('payroll_effective_date'), '薪資生效日期', errors) || record.hire_date || new Date().toISOString().slice(0, 10),
      };
      const payrollProvided = payrollFields.some(key => map[key] != null && get(key) !== '');
      const existingEmployee = existing.get(normalize(employeeNo));
      records.push({
        rowNo, record, password, payroll, payrollProvided,
        assignedSites: parseSites(get('assigned_sites'), errors),
        assignedSitesProvided,
        providedEmployeeFields,
        existingEmployee,
        errors,
      });
    });
    if (!records.length) throw new Error('檔案內沒有可匯入的員工資料。');
    return records;
  }
  async function readFile(file) {
    if (!window.XLSX) throw new Error('Excel 元件尚未載入，請重新整理後再試。');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('檔案內沒有工作表。');
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  }
  function ensureDialog() {
    let dialog = document.querySelector('#employeeImportDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'employeeImportDialog';
      dialog.className = 'employee-import-dialog';
      document.body.appendChild(dialog);
    }
    return dialog;
  }
  function statusText(item, mode) {
    if (item.errors.length) return '資料錯誤';
    if (item.existingEmployee && mode === 'add_only') return '重複略過';
    return item.existingEmployee ? '更新' : '新增';
  }
  function renderPreview(fileName) {
    const dialog = ensureDialog();
    const errorCount = parsedRows.filter(item => item.errors.length).length;
    const newCount = parsedRows.filter(item => !item.errors.length && !item.existingEmployee).length;
    const updateCount = parsedRows.filter(item => !item.errors.length && item.existingEmployee).length;
    dialog.innerHTML = `<form class="employee-import-form">
      <div class="dialog-head"><div><p class="eyebrow">人事管理</p><h3>員工資料批次匯入</h3></div><button type="button" class="icon-button employee-import-close" aria-label="關閉">×</button></div>
      <section class="employee-import-summary">
        <article><span>檔案</span><strong>${escapeHtml(fileName)}</strong></article>
        <article><span>可新增</span><strong>${newCount}</strong></article>
        <article><span>可更新</span><strong>${updateCount}</strong></article>
        <article class="${errorCount ? 'has-error' : ''}"><span>資料錯誤</span><strong>${errorCount}</strong></article>
      </section>
      <div class="employee-import-options">
        <label>遇到相同工號時
          <select id="employeeImportMode">
            <option value="add_only">略過重複工號，只新增新員工</option>
            <option value="upsert">依工號更新既有員工，並新增新員工</option>
          </select>
        </label>
        <p>有錯誤的列不會匯入；其他正確資料仍會繼續處理。若有填初始密碼，會同步建立或更新登入帳號。</p>
      </div>
      <div class="table-wrap employee-import-preview"><table><thead><tr><th>Excel列</th><th>工號</th><th>姓名</th><th>職稱</th><th>案場</th><th>預計處理</th><th>檢查結果</th></tr></thead><tbody>
        ${parsedRows.map(item => `<tr class="${item.errors.length ? 'import-row-error' : ''}"><td>${item.rowNo}</td><td>${escapeHtml(item.record.employee_no)}</td><td>${escapeHtml(item.record.full_name)}</td><td>${escapeHtml(item.record.job_title)}</td><td>${item.assignedSites.length}</td><td class="employee-import-action">${statusText(item, 'add_only')}</td><td>${item.errors.length ? escapeHtml(item.errors.join('；')) : '通過'}</td></tr>`).join('')}
      </tbody></table></div>
      <p id="employeeImportMessage" class="form-message"></p>
      <div class="dialog-actions"><button type="button" class="btn ghost employee-import-close">取消</button><button type="submit" class="btn primary" id="employeeImportStart">開始匯入可用資料</button></div>
    </form>`;
    const mode = dialog.querySelector('#employeeImportMode');
    const refreshActions = () => dialog.querySelectorAll('.employee-import-action').forEach((cell, index) => { cell.textContent = statusText(parsedRows[index], mode.value); });
    mode.onchange = refreshActions;
    dialog.querySelectorAll('.employee-import-close').forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      importRows(mode.value, dialog);
    };
    dialog.showModal();
  }
  async function invokeAccount(employee, password) {
    const { data, error } = await ctx.client.functions.invoke('quick-worker', { body: { employee_id: employee.id, password } });
    if (error) {
      let message = error.message || '登入帳號建立失敗';
      try {
        const detail = error.context ? await error.context.json() : null;
        if (detail?.error) message = detail.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || '登入帳號建立失敗');
  }
  async function saveOne(item, mode) {
    if (item.errors.length) return { status: '失敗', detail: item.errors.join('；') };
    if (item.existingEmployee && mode === 'add_only') return { status: '略過', detail: '工號已存在' };
    let saved;
    if (ctx.cloudEnabled) {
      const employeePayload = item.existingEmployee
        ? Object.fromEntries(Object.entries(item.record).filter(([key]) => item.providedEmployeeFields.has(key)))
        : item.record;
      const query = item.existingEmployee
        ? ctx.client.from('employees').update(employeePayload).eq('id', item.existingEmployee.id)
        : ctx.client.from('employees').insert(employeePayload);
      const { data, error } = await query.select().single();
      if (error) throw error;
      saved = data;
      if (item.payrollProvided) {
        const { error: payrollError } = await ctx.client.from('employee_payroll_profiles').upsert({ employee_id: saved.id, ...item.payroll }, { onConflict: 'employee_id' });
        if (payrollError) throw new Error(`薪資設定同步失敗：${payrollError.message}`);
      }
      if (item.assignedSitesProvided) {
        const { error: deleteError } = await ctx.client.from('site_assignments').delete().eq('employee_id', saved.id);
        if (deleteError) throw new Error(`案場指派清除失敗：${deleteError.message}`);
        if (item.assignedSites.length) {
          const startDate = item.record.hire_date || new Date().toISOString().slice(0, 10);
          const { error: siteError } = await ctx.client.from('site_assignments').insert(item.assignedSites.map(siteId => ({ employee_id: saved.id, site_id: siteId, start_date: startDate })));
          if (siteError) throw new Error(`案場指派同步失敗：${siteError.message}`);
        }
      }
      if (item.password) await invokeAccount(saved, item.password);
    } else {
      const employeePayload = item.existingEmployee
        ? Object.fromEntries(Object.entries(item.record).filter(([key]) => item.providedEmployeeFields.has(key)))
        : item.record;
      saved = await ctx.db.save('employees', employeePayload, item.existingEmployee?.id || null);
    }
    return {
      status: item.existingEmployee ? '已更新' : '已新增',
      detail: item.password && ctx.cloudEnabled ? '員工資料與登入帳號皆已完成' : '員工資料已完成',
    };
  }
  async function importRows(mode, dialog) {
    const button = dialog.querySelector('#employeeImportStart');
    const message = dialog.querySelector('#employeeImportMessage');
    button.disabled = true;
    resultRows = [];
    const candidates = parsedRows.filter(item => !item.errors.length);
    for (let index = 0; index < candidates.length; index += 1) {
      const item = candidates[index];
      message.textContent = `正在處理 ${index + 1} / ${candidates.length}：${item.record.employee_no} ${item.record.full_name}`;
      try {
        const result = await saveOne(item, mode);
        resultRows.push({ rowNo: item.rowNo, employeeNo: item.record.employee_no, fullName: item.record.full_name, ...result });
      } catch (error) {
        resultRows.push({ rowNo: item.rowNo, employeeNo: item.record.employee_no, fullName: item.record.full_name, status: '失敗', detail: error.message || String(error) });
      }
    }
    parsedRows.filter(item => item.errors.length).forEach(item => resultRows.push({
      rowNo: item.rowNo, employeeNo: item.record.employee_no, fullName: item.record.full_name, status: '失敗', detail: item.errors.join('；'),
    }));
    await ctx.reload();
    renderResults(dialog);
  }
  function renderResults(dialog) {
    const successCount = resultRows.filter(item => ['已新增', '已更新'].includes(item.status)).length;
    const failedCount = resultRows.filter(item => item.status === '失敗').length;
    dialog.innerHTML = `<section class="employee-import-result">
      <div class="dialog-head"><div><p class="eyebrow">批次處理完成</p><h3>員工匯入結果</h3></div><button type="button" class="icon-button employee-import-finish">×</button></div>
      <section class="employee-import-summary"><article><span>完成</span><strong>${successCount}</strong></article><article><span>略過</span><strong>${resultRows.filter(item => item.status === '略過').length}</strong></article><article class="${failedCount ? 'has-error' : ''}"><span>失敗</span><strong>${failedCount}</strong></article></section>
      <div class="table-wrap employee-import-preview"><table><thead><tr><th>Excel列</th><th>工號</th><th>姓名</th><th>結果</th><th>說明</th></tr></thead><tbody>${resultRows.map(item => `<tr class="${item.status === '失敗' ? 'import-row-error' : ''}"><td>${item.rowNo}</td><td>${escapeHtml(item.employeeNo)}</td><td>${escapeHtml(item.fullName)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join('')}</tbody></table></div>
      <div class="dialog-actions"><button type="button" class="btn ghost" id="employeeImportDownloadResult">下載結果 CSV</button><button type="button" class="btn primary employee-import-finish">完成</button></div>
    </section>`;
    dialog.querySelectorAll('.employee-import-finish').forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector('#employeeImportDownloadResult').onclick = downloadResults;
    ctx.notice(`員工匯入完成：成功 ${successCount} 筆、失敗 ${failedCount} 筆。`, failedCount ? 'error' : 'success');
  }
  function downloadResults() {
    const rows = [['Excel列', '工號', '姓名', '結果', '說明'], ...resultRows.map(item => [item.rowNo, item.employeeNo, item.fullName, item.status, item.detail])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `員工匯入結果-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function openFile(file) {
    if (!file) return;
    try {
      parsedRows = parseMatrix(await readFile(file));
      renderPreview(file.name);
    } catch (error) {
      ctx.notice(`員工資料讀取失敗：${error.message || error}`, 'error');
    }
  }
  function configure(options) {
    ctx = options;
  }
  function attach(container) {
    if (!ctx || !container || container.querySelector('#employeeImportFile')) return;
    const template = document.createElement('a');
    template.className = 'btn ghost';
    template.href = TEMPLATE_URL;
    template.download = '紘嘉ERP員工批次匯入範本.xlsx';
    template.textContent = '下載員工匯入範本';
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'btn ghost';
    upload.textContent = '上傳員工資料';
    const input = document.createElement('input');
    input.id = 'employeeImportFile';
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.hidden = true;
    upload.onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = '';
      await openFile(file);
    };
    container.append(template, upload, input);
  }

  window.EmployeeImport = { configure, attach };
})();
