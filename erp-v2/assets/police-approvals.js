(() => {
  'use strict';

  const cfg = window.ERP_CONFIG || {};
  const cloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = cloud
    ? (window.ERP_CLIENT || (window.ERP_CLIENT = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)))
    : null;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const statusLabels = {
    not_submitted: '未送件',
    submitted: '已送件',
    supplement_required: '補件中',
    approved: '核備通過',
    rejected: '不予核備'
  };
  const documentPrefix = '鴻嘉(核)字號';
  const mainDemoKey = 'hongjia_erp_demo_v2';
  let employees = [];
  let approvals = [];
  let filterStatus = 'all';
  let searchText = '';
  const selectedEmployeeIds = new Set();

  const useCloud = () => cloud && !window.ERP_DEMO_MODE;
  const readDemo = () => {
    try { return JSON.parse(localStorage.getItem(mainDemoKey)) || {}; } catch (_) { return {}; }
  };
  const writeDemo = data => localStorage.setItem(mainDemoKey, JSON.stringify(data));
  const documentNumberOnly = value => String(value || '').replace(/\D/g, '');
  const fullDocumentNumber = value => {
    const number = documentNumberOnly(value);
    return number ? `${documentPrefix} ${number}` : '—';
  };

  async function load() {
    if (useCloud()) {
      const [employeeResult, approvalResult] = await Promise.all([
        client.from('employees').select('id,employee_no,full_name,job_title,status').order('employee_no'),
        client.from('employee_police_approvals').select('*')
      ]);
      if (employeeResult.error || approvalResult.error) throw employeeResult.error || approvalResult.error;
      employees = employeeResult.data || [];
      approvals = approvalResult.data || [];
      return;
    }
    const data = readDemo();
    employees = data.employees || [];
    approvals = data.employee_police_approvals || [];
  }

  function rowFor(employee) {
    const approval = approvals.find(item => item.employee_id === employee.id);
    return {
      id: approval?.id || null,
      employee_id: employee.id,
      employee_no: employee.employee_no,
      full_name: employee.full_name,
      job_title: employee.job_title,
      employee_status: employee.status,
      status: approval?.status || 'not_submitted',
      police_station: approval?.police_station || '',
      submitted_date: approval?.submitted_date || '',
      document_no: documentNumberOnly(approval?.document_no),
      approval_date: approval?.approval_date || '',
      note: approval?.note || ''
    };
  }

  function allRows() {
    return employees.map(rowFor);
  }

  function filteredRows() {
    const keyword = searchText.trim().toLowerCase();
    return allRows().filter(row =>
      (filterStatus === 'all' || row.status === filterStatus)
      && (!keyword || `${row.employee_no} ${row.full_name} ${row.job_title || ''} ${row.police_station} ${row.document_no}`.toLowerCase().includes(keyword))
    );
  }

  function badge(status) {
    const className = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'submitted' || status === 'supplement_required' ? 'warning' : '';
    return `<span class="badge ${className}">${esc(statusLabels[status] || status)}</span>`;
  }

  function renderTable() {
    const rows = filteredRows();
    const tbody = $('#policeApprovalRows');
    if (!tbody) return;
    tbody.innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td class="police-select-cell"><input type="checkbox" data-police-select="${esc(row.employee_id)}" aria-label="選取 ${esc(row.full_name)}" ${selectedEmployeeIds.has(row.employee_id) ? 'checked' : ''}></td>
        <td><strong>${esc(row.employee_no)}</strong></td>
        <td>${esc(row.full_name)}<small>${esc(row.job_title || '')}</small></td>
        <td>${badge(row.status)}</td>
        <td>${esc(row.police_station || '—')}</td>
        <td>${esc(row.submitted_date || '—')}</td>
        <td>${esc(fullDocumentNumber(row.document_no))}</td>
        <td>${esc(row.approval_date || '—')}</td>
        <td class="police-row-actions"><button class="mini-button" type="button" data-police-print-one="${esc(row.employee_id)}">單獨列印</button><button class="mini-button" type="button" data-police-edit="${esc(row.employee_id)}">編輯核備</button></td>
      </tr>
    `).join('') : '<tr><td colspan="9" class="empty">沒有符合條件的員工。</td></tr>';
    $$('[data-police-select]').forEach(input => {
      input.onchange = () => {
        input.checked ? selectedEmployeeIds.add(input.dataset.policeSelect) : selectedEmployeeIds.delete(input.dataset.policeSelect);
        updateSelectionControls();
      };
    });
    $$('[data-police-print-one]').forEach(button => button.onclick = () => {
      const employee = employees.find(item => item.id === button.dataset.policePrintOne);
      printRows(employee ? [rowFor(employee)] : []);
    });
    $$('[data-police-edit]').forEach(button => button.onclick = () => openEditor(button.dataset.policeEdit));
    updateSelectionControls();
    updateSummary();
  }

  function updateSelectionControls() {
    const visibleIds = filteredRows().map(row => row.employee_id);
    const selectAll = $('#policeApprovalSelectAll');
    if (selectAll) {
      const selectedVisible = visibleIds.filter(id => selectedEmployeeIds.has(id)).length;
      selectAll.checked = Boolean(visibleIds.length) && selectedVisible === visibleIds.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
    const button = $('#printSelectedPoliceApprovals');
    if (button) {
      button.textContent = `列印勾選資料（${selectedEmployeeIds.size}）`;
      button.disabled = selectedEmployeeIds.size === 0;
    }
  }

  function updateSummary() {
    const rows = allRows();
    const counts = Object.fromEntries(Object.keys(statusLabels).map(status => [status, rows.filter(row => row.status === status).length]));
    Object.entries(counts).forEach(([status, count]) => {
      const target = $(`[data-police-count="${status}"]`);
      if (target) target.textContent = String(count);
    });
  }

  function ensureDialog() {
    let dialog = $('#policeApprovalDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'policeApprovalDialog';
    dialog.className = 'police-approval-dialog';
    dialog.innerHTML = `
      <form id="policeApprovalForm">
        <div class="dialog-head"><div><p class="eyebrow">人事管理</p><h3 id="policeApprovalDialogTitle">警局核備</h3></div><button type="button" class="icon-button police-dialog-close" aria-label="關閉">×</button></div>
        <input type="hidden" name="employee_id">
        <div class="form-grid">
          <label>核備狀態<select name="status" required>
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select></label>
          <label>送件／核備警局<input name="police_station" placeholder="例如：八德分局"></label>
          <label>送件日期<input name="submitted_date" type="date"></label>
          <label>公司核備字號<div class="police-document-number-control"><span>${documentPrefix}</span><input name="document_no" inputmode="numeric" pattern="[0-9]*" placeholder="請填號碼，例如 000001"></div><small>只需輸入後方號碼，列印時會自動顯示完整字號。</small></label>
          <label>核備結果日期<input name="approval_date" type="date"></label>
          <label class="wide">備註／補件內容<textarea name="note"></textarea></label>
        </div>
        <p id="policeApprovalMessage" class="form-message"></p>
        <div class="dialog-actions"><button type="button" class="btn ghost police-dialog-close">取消</button><button class="btn primary" type="submit">儲存核備資料</button></div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('.police-dialog-close').forEach(button => button.onclick = () => dialog.close());
    $('#policeApprovalForm').onsubmit = save;
    return dialog;
  }

  function openEditor(employeeId) {
    const employee = employees.find(item => item.id === employeeId);
    if (!employee) return;
    const row = rowFor(employee);
    const dialog = ensureDialog();
    $('#policeApprovalDialogTitle').textContent = `${employee.employee_no}－${employee.full_name} 警局核備`;
    Object.entries(row).forEach(([name, value]) => {
      const input = dialog.querySelector(`[name="${name}"]`);
      if (input) input.value = value ?? '';
    });
    $('#policeApprovalMessage').textContent = '';
    dialog.showModal();
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const message = $('#policeApprovalMessage');
    const payload = {
      employee_id: values.employee_id,
      status: values.status || 'not_submitted',
      police_station: values.police_station || null,
      submitted_date: values.submitted_date || null,
      document_no: documentNumberOnly(values.document_no) || null,
      approval_date: values.approval_date || null,
      note: values.note || null
    };
    if (['submitted', 'supplement_required', 'approved', 'rejected'].includes(payload.status) && (!payload.police_station || !payload.submitted_date)) {
      message.textContent = '已送件後請填寫送件警局與送件日期。';
      return;
    }
    message.textContent = '儲存中…';
    try {
      if (useCloud()) {
        const { error } = await client.from('employee_police_approvals').upsert(payload, { onConflict: 'employee_id' });
        if (error) throw error;
      } else {
        const data = readDemo();
        data.employee_police_approvals = data.employee_police_approvals || [];
        const index = data.employee_police_approvals.findIndex(item => item.employee_id === payload.employee_id);
        const record = { id: index >= 0 ? data.employee_police_approvals[index].id : crypto.randomUUID(), ...payload };
        if (index >= 0) data.employee_police_approvals[index] = record;
        else data.employee_police_approvals.unshift(record);
        writeDemo(data);
      }
      await load();
      ensureDialog().close();
      renderTable();
      if (window.ERP_SHOW_NOTICE) window.ERP_SHOW_NOTICE('警局核備資料已同步更新。', 'success');
    } catch (error) {
      message.textContent = `儲存失敗：${error.message}`;
    }
  }

  function printRows(rows) {
    const printableRows = (rows || []).filter(Boolean);
    if (!printableRows.length) {
      if (window.ERP_SHOW_NOTICE) window.ERP_SHOW_NOTICE('請先勾選要列印的警局核備資料。', 'error');
      return;
    }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(frame);
    frame.srcdoc = `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>警局核備清冊</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:"Microsoft JhengHei",sans-serif;color:#16324f}h1{text-align:center;margin:0 0 8px}.meta{text-align:right;margin:0 0 14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #8091a0;padding:8px;font-size:12px;text-align:center}th{background:#eaf0f4}.document-no{font-weight:700;white-space:nowrap}</style></head><body><h1>紘嘉物業保全－警局核備清冊</h1><p class="meta">列印日期：${new Date().toLocaleDateString('zh-TW')}　｜　共 ${printableRows.length} 筆</p><table><thead><tr><th>工號</th><th>姓名</th><th>職稱</th><th>狀態</th><th>送件警局</th><th>送件日期</th><th>鴻嘉(核)字號</th><th>核備日期</th></tr></thead><tbody>${printableRows.map(row => `<tr><td>${esc(row.employee_no)}</td><td>${esc(row.full_name)}</td><td>${esc(row.job_title)}</td><td>${esc(statusLabels[row.status])}</td><td>${esc(row.police_station || '—')}</td><td>${esc(row.submitted_date || '—')}</td><td class="document-no">${esc(fullDocumentNumber(row.document_no))}</td><td>${esc(row.approval_date || '—')}</td></tr>`).join('')}</tbody></table></body></html>`;
    frame.onload = () => {
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60000);
    };
  }

  function printSelectedRows() {
    printRows(allRows().filter(row => selectedEmployeeIds.has(row.employee_id)));
  }

  async function render() {
    const content = $('#content');
    content.innerHTML = '<article class="panel empty">載入警局核備資料中…</article>';
    try {
      await load();
      content.innerHTML = `
        <section class="police-summary">
          ${Object.entries(statusLabels).map(([status, label]) => `<article><span>${esc(label)}</span><strong data-police-count="${status}">0</strong></article>`).join('')}
        </section>
        <article class="panel">
          <div class="panel-head police-approval-head">
            <div><p class="eyebrow">人事管理</p><h3>警局核備</h3><span class="muted">所有在職員工皆會列入；此處與員工管理共用同一份資料。</span></div>
            <button class="btn ghost" id="printSelectedPoliceApprovals" type="button" disabled>列印勾選資料（0）</button>
          </div>
          <div class="police-filter-bar">
            <label>狀態篩選<select id="policeApprovalStatusFilter"><option value="all">全部狀態</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
            <label>搜尋員工<input id="policeApprovalSearch" type="search" placeholder="工號、姓名、警局或文號"></label>
          </div>
          <div class="table-wrap"><table><thead><tr><th class="police-select-cell"><input id="policeApprovalSelectAll" type="checkbox" aria-label="選取目前篩選結果"></th><th>工號</th><th>員工</th><th>核備狀態</th><th>送件警局</th><th>送件日期</th><th>鴻嘉(核)字號</th><th>核備日期</th><th>操作</th></tr></thead><tbody id="policeApprovalRows"></tbody></table></div>
        </article>`;
      $('#policeApprovalStatusFilter').value = filterStatus;
      $('#policeApprovalStatusFilter').onchange = event => { filterStatus = event.target.value; renderTable(); };
      $('#policeApprovalSearch').value = searchText;
      $('#policeApprovalSearch').oninput = event => { searchText = event.target.value; renderTable(); };
      $('#policeApprovalSelectAll').onchange = event => {
        filteredRows().forEach(row => event.target.checked ? selectedEmployeeIds.add(row.employee_id) : selectedEmployeeIds.delete(row.employee_id));
        renderTable();
      };
      $('#printSelectedPoliceApprovals').onclick = printSelectedRows;
      renderTable();
    } catch (error) {
      content.innerHTML = `<article class="panel empty">載入失敗：${esc(error.message)}<br><small>若資料庫尚未建立警局核備資料表，請先執行 migration-employee-police-approvals.sql。</small></article>`;
    }
  }

  window.PoliceApprovals = { render, openEditor };
})();
