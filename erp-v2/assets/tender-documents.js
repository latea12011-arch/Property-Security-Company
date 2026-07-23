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
  const useCloud = () => cloud && !window.ERP_DEMO_MODE;
  const demoKey = 'hongjia_tender_documents_demo';
  const quoteDemoKey = 'hongjia_tender_quotes_demo';
  let quotes = [];
  let packages = [];
  let current = null;
  let pendingQuoteId = '';

  const defaultChecklist = [
    '紘嘉保全：內政部警政署核發之特許登記證',
    '紘嘉保全：經濟部許可函（資本額新臺幣肆千萬元）',
    '紘嘉公寓：公寓大廈管理維護公司登記證',
    '紘嘉公寓：經濟部許可函（資本額新臺幣貳仟參佰萬元）',
    '保全及公寓大廈公會會員證、比價證明、自律公約證書',
    '兩公司最近期 401 申報書',
    '兩公司最近期 401 完稅證明',
    '兩公司一年內無退票證明',
    '紘嘉保全意外傷害責任險、團體保險證',
    '紘嘉公寓誠實險',
    '兩公司近半年勞健保、勞退繳費證明',
    '內政部警政署種子教官訓練合格證書',
    '甲種職業安全衛生管理員訓練合格證書',
    '相關實績合約影本（例如立天下社區、臻美社區）'
  ].map((label, index) => ({ id: `default-${index + 1}`, label, checked: false, note: '' }));

  const today = () => new Date().toLocaleDateString('en-CA');
  const readDemo = key => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (_) { return []; }
  };
  const saveDemo = rows => localStorage.setItem(demoKey, JSON.stringify(rows));

  async function loadQuotes() {
    if (!useCloud()) return readDemo(quoteDemoKey);
    const { data, error } = await client.from('tender_quotations').select('*').order('quote_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function loadPackages() {
    if (!useCloud()) return readDemo(demoKey);
    const { data, error } = await client.from('tender_document_packages').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function recordForQuote(quotationId) {
    return packages.find(row => row.quotation_id === quotationId) || null;
  }

  function baseRecord(quote = {}) {
    return {
      id: null,
      quotation_id: quote.id || '',
      package_no: quote.quote_no || '',
      bid_no: quote.quote_no || '',
      client_name: quote.client_name || '',
      project_name: quote.project_name || '',
      recipient_name: quote.client_name ? `${quote.client_name}　收` : '',
      recipient_address: quote.site_address || '',
      deadline_date: quote.valid_until || '',
      deadline_time: '',
      delivery_method: 'personal',
      sender_name: '紘嘉保全股份有限公司／紘嘉公寓大廈管理維護股份有限公司',
      sender_address: '334 桃園市八德區高城路23號1樓',
      sender_phone: '03-283-0453',
      sender_tax_id: '94012985',
      envelope_no: '',
      checklist: structuredClone(defaultChecklist),
      prepared_by: '',
      prepared_date: today(),
      note: ''
    };
  }

  function normalizeChecklist(value) {
    const list = Array.isArray(value) ? value : [];
    return list.length
      ? list.map((item, index) => ({
          id: item.id || `item-${index + 1}`,
          label: String(item.label || ''),
          checked: Boolean(item.checked),
          note: String(item.note || '')
        }))
      : structuredClone(defaultChecklist);
  }

  function renderChecklist(list) {
    return normalizeChecklist(list).map(item => `
      <div class="tender-check-item" data-check-id="${esc(item.id)}">
        <input class="tender-check-done" type="checkbox" aria-label="已備妥" ${item.checked ? 'checked' : ''}>
        <input class="tender-check-label" value="${esc(item.label)}" aria-label="文件名稱">
        <input class="tender-check-note" value="${esc(item.note)}" placeholder="備註／有效期限" aria-label="備註">
        <button class="mini-button danger tender-check-remove" type="button">移除</button>
      </div>
    `).join('');
  }

  function collectChecklist() {
    return $$('.tender-check-item').map((row, index) => ({
      id: row.dataset.checkId || `custom-${Date.now()}-${index}`,
      label: row.querySelector('.tender-check-label').value.trim(),
      checked: row.querySelector('.tender-check-done').checked,
      note: row.querySelector('.tender-check-note').value.trim()
    })).filter(item => item.label);
  }

  function selectedQuote() {
    return quotes.find(quote => quote.id === $('#tenderDocumentQuote')?.value) || {};
  }

  function renderWorkspace(record) {
    current = { ...baseRecord(selectedQuote()), ...record, checklist: normalizeChecklist(record?.checklist) };
    const content = $('#content');
    content.innerHTML = `
      <form id="tenderDocumentForm" class="tender-document-form">
        <article class="panel tender-document-toolbar">
          <div>
            <p class="eyebrow">業務與競標</p>
            <h3>投標文件管理</h3>
            <span class="muted">確認表可逐項勾選；外標封、證件封及標單封由標案資料自動產生。</span>
          </div>
          <label>連結競標報價
            <select id="tenderDocumentQuote" name="quotation_id">
              <option value="">不連結報價單</option>
              ${quotes.map(quote => `<option value="${esc(quote.id)}" ${quote.id === current.quotation_id ? 'selected' : ''}>${esc(quote.quote_no)}｜${esc(quote.client_name)}｜${esc(quote.project_name)}</option>`).join('')}
            </select>
          </label>
          <button class="btn primary" type="submit">儲存投標文件</button>
        </article>

        <div class="tender-document-grid">
          <article class="panel">
            <div class="panel-head">
              <div>
                <h3 id="tenderChecklistTitle">投標文件確認表</h3>
                <span class="muted">沿用原確認表內容，並可自行增減項目與備註。</span>
              </div>
              <button id="addTenderCheckItem" class="mini-button" type="button">＋新增文件</button>
            </div>
            <div class="tender-check-head"><span>完成</span><span>文件名稱</span><span>備註</span><span>操作</span></div>
            <div id="tenderChecklist">${renderChecklist(current.checklist)}</div>
            <div class="tender-document-meta">
              <label>文件準備人<input name="prepared_by" value="${esc(current.prepared_by)}"></label>
              <label>確認日期<input name="prepared_date" type="date" value="${esc(current.prepared_date || today())}"></label>
            </div>
            <button id="previewTenderChecklist" class="btn ghost" type="button">預覽／列印確認表</button>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h3>封單資料設定</h3>
                <span class="muted">修改一次後，可分別列印三種封單，不必重複排版。</span>
              </div>
            </div>
            <div class="form-grid tender-envelope-fields">
              <label>文件／包件編號<input name="package_no" value="${esc(current.package_no)}"></label>
              <label>招標編號<input name="bid_no" value="${esc(current.bid_no)}"></label>
              <label>管委會／招標單位<input name="client_name" value="${esc(current.client_name)}"></label>
              <label>收件人<input name="recipient_name" value="${esc(current.recipient_name)}"></label>
              <label class="wide">標案名稱<input name="project_name" value="${esc(current.project_name)}"></label>
              <label class="wide">收件地址<input name="recipient_address" value="${esc(current.recipient_address)}"></label>
              <label>送件截止日期<input name="deadline_date" type="date" value="${esc(current.deadline_date)}"></label>
              <label>送件截止時間<input name="deadline_time" type="time" value="${esc(current.deadline_time)}"></label>
              <label>送達方式<select name="delivery_method">
                <option value="personal" ${current.delivery_method === 'personal' ? 'selected' : ''}>專人送達</option>
                <option value="postal" ${current.delivery_method === 'postal' ? 'selected' : ''}>郵遞送達</option>
              </select></label>
              <label>封單編號<input name="envelope_no" value="${esc(current.envelope_no)}"></label>
              <label class="wide">投標廠商名稱<input name="sender_name" value="${esc(current.sender_name)}"></label>
              <label class="wide">公司地址<input name="sender_address" value="${esc(current.sender_address)}"></label>
              <label>公司電話<input name="sender_phone" value="${esc(current.sender_phone)}"></label>
              <label>統一編號<input name="sender_tax_id" value="${esc(current.sender_tax_id)}"></label>
              <label class="wide">內部備註<textarea name="note">${esc(current.note)}</textarea></label>
            </div>
            <div class="tender-print-actions">
              <button class="mini-button" type="button" data-tender-preview="outer">外標封</button>
              <button class="mini-button" type="button" data-tender-preview="credentials">證件封</button>
              <button class="mini-button" type="button" data-tender-preview="bid">標單封</button>
              <button class="btn primary" type="button" data-tender-preview="all">一次預覽三種封單</button>
            </div>
          </article>
        </div>
        <p id="tenderDocumentMessage" class="form-message"></p>
      </form>
    `;
    bindWorkspace();
  }

  function bindChecklistRows() {
    $$('.tender-check-remove').forEach(button => {
      button.onclick = () => {
        button.closest('.tender-check-item').remove();
        updateCompletion();
      };
    });
    $$('.tender-check-done').forEach(input => input.onchange = updateCompletion);
    updateCompletion();
  }

  function updateCompletion() {
    const rows = $$('.tender-check-item');
    const done = rows.filter(row => row.querySelector('.tender-check-done').checked).length;
    const heading = $('#tenderChecklistTitle');
    if (heading) heading.textContent = `投標文件確認表（${done}/${rows.length}）`;
  }

  function bindWorkspace() {
    bindChecklistRows();
    $('#addTenderCheckItem').onclick = () => {
      $('#tenderChecklist').insertAdjacentHTML('beforeend', renderChecklist([{
        id: `custom-${crypto.randomUUID()}`, label: '', checked: false, note: ''
      }]));
      bindChecklistRows();
      $('#tenderChecklist .tender-check-item:last-child .tender-check-label').focus();
    };
    $('#tenderDocumentQuote').onchange = event => {
      const quote = quotes.find(item => item.id === event.target.value) || {};
      const existing = recordForQuote(event.target.value);
      renderWorkspace(existing || baseRecord(quote));
    };
    $('#tenderDocumentForm').onsubmit = save;
    $('#previewTenderChecklist').onclick = () => preview('checklist');
    $$('[data-tender-preview]').forEach(button => button.onclick = () => preview(button.dataset.tenderPreview));
  }

  function collectRecord() {
    const form = $('#tenderDocumentForm');
    const values = Object.fromEntries(new FormData(form).entries());
    return {
      ...values,
      quotation_id: values.quotation_id || null,
      deadline_date: values.deadline_date || null,
      deadline_time: values.deadline_time || null,
      prepared_date: values.prepared_date || null,
      checklist: collectChecklist()
    };
  }

  async function save(event) {
    event.preventDefault();
    const message = $('#tenderDocumentMessage');
    const record = collectRecord();
    if (!record.project_name || !record.recipient_name) {
      message.textContent = '請至少填寫標案名稱及收件人。';
      return;
    }
    message.textContent = '儲存中…';
    try {
      if (useCloud()) {
        const query = current?.id
          ? client.from('tender_document_packages').update(record).eq('id', current.id)
          : client.from('tender_document_packages').insert(record);
        const { data, error } = await query.select().single();
        if (error) throw error;
        current = data;
      } else {
        const rows = readDemo(demoKey);
        current = { ...record, id: current?.id || crypto.randomUUID(), updated_at: new Date().toISOString() };
        saveDemo(current.id && rows.some(row => row.id === current.id)
          ? rows.map(row => row.id === current.id ? current : row)
          : [current, ...rows]);
      }
      packages = await loadPackages();
      message.style.color = 'var(--green)';
      message.textContent = '投標確認表與封單資料已儲存。';
    } catch (error) {
      message.style.color = '';
      message.textContent = `儲存失敗：${error.message}`;
    }
  }

  function formRecord() {
    return collectRecord();
  }

  function displayDeadline(record) {
    const date = record.deadline_date || '____年__月__日';
    return `${esc(date)}${record.deadline_time ? `　${esc(record.deadline_time)}` : ''}`;
  }

  function envelopePage(record, kind) {
    const title = kind === 'credentials' ? '證件封' : kind === 'bid' ? '標單封' : '外標封';
    const content = kind === 'credentials'
      ? '<div class="seal-content"><b>本證件封內容：</b><br>投標須知規定之資格證件影本。</div>'
      : '';
    if (kind === 'outer') {
      return `<section class="print-page outer-envelope">
        <div class="sender"><b>${esc(record.sender_name)}</b><br>統一編號：${esc(record.sender_tax_id)}<br>${esc(record.sender_address)}<br>${esc(record.sender_phone)}</div>
        <div class="envelope-number">編號：${esc(record.envelope_no || record.bid_no || '')}</div>
        <h1>${title}</h1>
        <div class="recipient-address">${esc(record.recipient_address)}</div>
        <div class="recipient-name">${esc(record.recipient_name)}</div>
        <div class="project-box"><b>標案名稱：</b>${esc(record.project_name)}<br><b>送件截止：</b>${displayDeadline(record)}</div>
        <div class="delivery">${record.delivery_method === 'postal' ? '■' : '□'} 郵遞送達　${record.delivery_method === 'personal' ? '■' : '□'} 專人送達<br><br>送達時間：____年__月__日__時__分</div>
        <div class="signatures">招標單位簽收人員簽章：____________________　　廠商送達人員簽章：____________________</div>
      </section>`;
    }
    return `<section class="print-page inner-envelope">
      <div class="envelope-number">編號：${esc(record.envelope_no || record.bid_no || '')}</div>
      <h1>${title}</h1>
      ${content}
      <div class="inner-project"><b>標案名稱</b><span>${esc(record.project_name)}</span></div>
      <div class="company-grid">
        <b>廠商名稱</b><span>${esc(record.sender_name)}</span>
        <b>地址</b><span>${esc(record.sender_address)}</span>
        <b>電話</b><span>${esc(record.sender_phone)}</span>
        <b>統一編號</b><span>${esc(record.sender_tax_id)}</span>
      </div>
    </section>`;
  }

  function checklistPage(record) {
    const list = normalizeChecklist(record.checklist);
    return `<section class="print-page checklist-page">
      <header><h1>紘嘉保全暨公寓大廈管理維護股份有限公司</h1><h2>案場投標文件確認表</h2></header>
      <div class="print-meta"><span>標案名稱：${esc(record.project_name)}</span><span>招標編號：${esc(record.bid_no)}</span></div>
      <table><thead><tr><th>完成</th><th>應備文件</th><th>備註</th></tr></thead>
      <tbody>${list.map(item => `<tr><td>${item.checked ? '☑' : '□'}</td><td>${esc(item.label)}</td><td>${esc(item.note)}</td></tr>`).join('')}</tbody></table>
      <footer>文件準備：${esc(record.prepared_by)}　　確認日期：${esc(record.prepared_date || '')}</footer>
    </section>`;
  }

  function printDocument(record, kind) {
    const body = kind === 'checklist'
      ? checklistPage(record)
      : kind === 'all'
        ? ['outer', 'credentials', 'bid'].map(type => envelopePage(record, type)).join('')
        : envelopePage(record, kind);
    const isChecklist = kind === 'checklist';
    return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(record.project_name)}－投標文件</title>
      <style>
        @page{size:A4 ${isChecklist ? 'portrait' : 'landscape'};margin:9mm}
        *{box-sizing:border-box}body{margin:0;color:#102b45;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif}
        .print-page{position:relative;min-height:${isChecklist ? '277mm' : '190mm'};padding:12mm;page-break-after:always;border:2px solid #102b45}
        .print-page:last-child{page-break-after:auto}.sender{font-size:13px;line-height:1.65}.envelope-number{position:absolute;right:12mm;top:12mm;font-size:18px;font-weight:800}
        h1{text-align:center;font-size:42px;letter-spacing:.25em;margin:6mm 0 12mm}.recipient-address{text-align:center;font-size:22px;margin-top:8mm}
        .recipient-name{text-align:center;font-size:38px;font-weight:900;margin:8mm 0}.project-box{width:78%;margin:0 auto;padding:8mm;border:1px solid #102b45;font-size:20px;line-height:1.9}
        .delivery{margin:10mm 0 0 11%;font-size:17px}.signatures{position:absolute;left:12mm;right:12mm;bottom:12mm;font-size:15px}
        .inner-envelope h1{margin-top:18mm}.seal-content{width:70%;margin:0 auto 12mm;padding:8mm;border:1px solid #102b45;font-size:20px;line-height:1.8}
        .inner-project,.company-grid{display:grid;grid-template-columns:36mm 1fr;width:78%;margin:0 auto;border:1px solid #102b45}
        .inner-project>* ,.company-grid>*{padding:5mm;border-bottom:1px solid #102b45}.inner-project b,.company-grid b{background:#eef3f7}
        .inner-project span,.company-grid span{font-size:18px}.company-grid{margin-top:8mm}.company-grid>*:nth-last-child(-n+2){border-bottom:0}
        .checklist-page{padding:10mm}.checklist-page header{text-align:center;border-bottom:2px solid #102b45;margin-bottom:5mm}.checklist-page h1{font-size:20px;letter-spacing:0;margin:0 0 2mm}
        .checklist-page h2{font-size:26px;margin:0 0 4mm}.print-meta{display:flex;justify-content:space-between;gap:8mm;margin-bottom:5mm;font-weight:800}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #697f92;padding:3mm;font-size:12px}th{background:#eaf0f4}th:first-child,td:first-child{width:16mm;text-align:center;font-size:18px}th:last-child,td:last-child{width:46mm}
        .checklist-page footer{margin-top:6mm;text-align:right;font-size:13px}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.print-page{border:0}}
      </style></head><body>${body}</body></html>`;
  }

  function ensurePreviewDialog() {
    let dialog = $('#tenderDocumentPreviewDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'tenderDocumentPreviewDialog';
    dialog.className = 'tender-document-preview-dialog';
    dialog.innerHTML = `<div class="tender-preview-head"><strong>投標文件預覽</strong><div><button class="btn primary" id="printTenderDocument" type="button">列印</button><button class="icon-button" id="closeTenderDocumentPreview" type="button">×</button></div></div><iframe title="投標文件列印預覽"></iframe>`;
    document.body.appendChild(dialog);
    $('#closeTenderDocumentPreview').onclick = () => dialog.close();
    $('#printTenderDocument').onclick = () => dialog.querySelector('iframe').contentWindow.print();
    return dialog;
  }

  function preview(kind) {
    const record = formRecord();
    if (!record.project_name || !record.recipient_name) {
      $('#tenderDocumentMessage').textContent = '請先填寫標案名稱與收件人，再預覽列印。';
      return;
    }
    const dialog = ensurePreviewDialog();
    dialog.querySelector('iframe').srcdoc = printDocument(record, kind);
    dialog.showModal();
  }

  async function render() {
    const content = $('#content');
    content.innerHTML = '<article class="panel empty">載入投標文件中…</article>';
    try {
      [quotes, packages] = await Promise.all([loadQuotes(), loadPackages()]);
      const quoteId = pendingQuoteId || packages[0]?.quotation_id || quotes[0]?.id || '';
      pendingQuoteId = '';
      const quote = quotes.find(item => item.id === quoteId) || {};
      renderWorkspace(recordForQuote(quoteId) || baseRecord(quote));
    } catch (error) {
      content.innerHTML = `<article class="panel empty">載入失敗：${esc(error.message)}<br><small>若雲端尚未建立投標文件資料表，請先執行 migration-tender-document-packages.sql。</small></article>`;
    }
  }

  function openFromQuotation(id) {
    pendingQuoteId = id || '';
    const button = document.querySelector('[data-view="tenderDocuments"]');
    if (button) button.click();
  }

  window.TenderDocuments = { render, openFromQuotation };
})();
