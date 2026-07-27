(() => {
  'use strict';

  const cfg = window.ERP_CONFIG || {};
  const cloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = cloud
    ? (window.ERP_CLIENT || (window.ERP_CLIENT = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)))
    : null;
  const useCloud = () => cloud && !window.ERP_DEMO_MODE;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const demoKey = 'hongjia_service_proposals_demo';
  const quoteDemoKey = 'hongjia_tender_quotes_demo';
  const lineOfficialUrl = 'https://lin.ee/XUE5xg6';
  const lineQrPath = 'assets/contracts/hongjia-line-official-qr.png';
  const logoPath = 'assets/company-logo.png';
  const originalPptPath = 'assets/contracts/hongjia-community-service-proposal-original.pptx';
  const originalSlideCount = 42;
  const originalSlidePath = page => new URL(
    `assets/service-proposal-slides/slide-${String(page).padStart(2, '0')}.png`,
    window.location.href
  ).href;
  const sectionOptions = [
    ['company', '公司能力與治理'],
    ['staffing', '人力配置與進場'],
    ['security', '安全勤務與日常秩序'],
    ['operations', '社區營運與財務透明'],
    ['digital', '數位管理與品質稽核']
  ];
  const statusLabels = { draft: '草稿', reviewing: '審核中', delivered: '已提案', won: '已承接', archived: '封存' };
  let rows = [];
  let quotes = [];
  let sites = [];
  let currentId = null;
  let logoDataUrl = '';
  let lineQrDataUrl = '';

  const today = () => new Date().toLocaleDateString('en-CA');
  const demoRows = () => {
    try { return JSON.parse(localStorage.getItem(demoKey)) || []; } catch (_) { return []; }
  };
  const saveDemo = value => localStorage.setItem(demoKey, JSON.stringify(value));
  const parseJson = (value, fallback) => {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
  };
  const safeFile = value => String(value || '社區綜合服務企劃書').replace(/[\\/:*?"<>|]/g, '_');

  function baseRecord(source = {}) {
    const quote = source.quote || {};
    const site = source.site || {};
    return {
      id: null,
      proposal_no: `P-${today().replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
      quotation_id: quote.id || null,
      site_id: site.id || null,
      proposal_date: today(),
      client_name: quote.client_name || '',
      project_name: quote.project_name || site.name || '',
      site_address: quote.site_address || site.address || '',
      community_phone: site.community_phone || '',
      contact_name: site.chairman_name || '',
      contact_phone: site.chairman_phone || '',
      household_count: site.household_count || '',
      building_count: '',
      service_start_date: quote.contract_start_date || '',
      staffing: [
        { role_name: '總幹事', headcount: 1, shift_time: '依社區需求', responsibility: '統籌行政、財務、修繕、廠商與住戶溝通' },
        { role_name: '駐點勤務人員', headcount: 3, shift_time: '依班表排定', responsibility: '門禁、巡邏、監控、交接與緊急應變' }
      ],
      enabled_sections: sectionOptions.map(item => item[0]),
      editable_content: {
        cover_community_name: quote.project_name || site.name || '',
        opening_message: '讓社區管理變得穩定、透明、可追蹤。',
        management_goal: '讓住戶感受到秩序，讓管委會掌握狀況，讓現場人員知道標準。',
        transition_plan: '前 30 天先完成資料與資產交接、穩定人力排班，再將現場缺失轉成改善計畫。',
        special_requirements: '',
        fee_note: '',
        closing_message: '我們承諾交付的，不只是一份班表，而是一套可以被看見、被查核、被持續改善的社區管理制度。',
        slide_overlays: []
      },
      status: 'draft',
      note: ''
    };
  }

  function normalize(row) {
    const base = baseRecord();
    return {
      ...base,
      ...row,
      staffing: parseJson(row?.staffing, base.staffing),
      enabled_sections: parseJson(row?.enabled_sections, base.enabled_sections),
      editable_content: { ...base.editable_content, ...parseJson(row?.editable_content, {}) }
    };
  }

  async function listProposals() {
    if (!useCloud()) return demoRows();
    const { data, error } = await client.from('community_service_proposals').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listQuotes() {
    if (!useCloud()) {
      try { return JSON.parse(localStorage.getItem(quoteDemoKey)) || []; } catch (_) { return []; }
    }
    const { data, error } = await client.from('tender_quotations').select('*').order('quote_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listSites() {
    if (!useCloud()) return [];
    const { data, error } = await client.from('sites').select('id,code,name,address,community_phone,chairman_name,chairman_phone,household_count').order('name');
    if (error) throw error;
    return data || [];
  }

  function staffingRow(item = {}) {
    return `
      <div class="proposal-staff-row">
        <input class="proposal-role" value="${esc(item.role_name)}" placeholder="職務">
        <input class="proposal-headcount" type="number" min="0" value="${esc(item.headcount ?? 1)}" placeholder="人數">
        <input class="proposal-shift" value="${esc(item.shift_time)}" placeholder="班別／時間">
        <input class="proposal-duty" value="${esc(item.responsibility)}" placeholder="主要工作">
        <button class="mini-button danger proposal-remove-staff" type="button">刪除</button>
      </div>`;
  }

  function collectStaffing() {
    return $$('.proposal-staff-row').map(row => ({
      role_name: row.querySelector('.proposal-role').value.trim(),
      headcount: Number(row.querySelector('.proposal-headcount').value || 0),
      shift_time: row.querySelector('.proposal-shift').value.trim(),
      responsibility: row.querySelector('.proposal-duty').value.trim()
    })).filter(item => item.role_name && item.headcount > 0);
  }

  function bindStaffRows() {
    $$('.proposal-remove-staff').forEach(button => {
      button.onclick = () => button.closest('.proposal-staff-row').remove();
    });
  }

  const overlayPositions = {
    top_left: '左上',
    top_right: '右上',
    center: '中央',
    bottom_left: '左下',
    bottom_right: '右下'
  };
  const overlayStyles = {
    title: '標題',
    note: '白底說明框',
    dark: '深藍重點框',
    plain: '透明文字'
  };

  function slideOverlayRow(item = {}) {
    const page = Math.min(originalSlideCount, Math.max(1, Number(item.page || 2)));
    const position = overlayPositions[item.position] ? item.position : 'bottom_right';
    const style = overlayStyles[item.style] ? item.style : 'note';
    return `
      <div class="proposal-slide-overlay-row">
        <label>頁碼<input class="proposal-overlay-page" type="number" min="1" max="${originalSlideCount}" value="${page}"></label>
        <label>位置<select class="proposal-overlay-position">${Object.entries(overlayPositions).map(([value, label]) => `<option value="${value}" ${position === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>樣式<select class="proposal-overlay-style">${Object.entries(overlayStyles).map(([value, label]) => `<option value="${value}" ${style === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="proposal-overlay-text-label">顯示文字<textarea class="proposal-overlay-text" placeholder="輸入後會直接顯示在指定的 PPT 頁面">${esc(item.text || '')}</textarea></label>
        <button class="mini-button danger proposal-remove-overlay" type="button">刪除</button>
      </div>`;
  }

  function collectSlideOverlays() {
    return $$('.proposal-slide-overlay-row').map(row => ({
      page: Math.min(originalSlideCount, Math.max(1, Number(row.querySelector('.proposal-overlay-page').value || 1))),
      position: row.querySelector('.proposal-overlay-position').value,
      style: row.querySelector('.proposal-overlay-style').value,
      text: row.querySelector('.proposal-overlay-text').value.trim()
    })).filter(item => item.text);
  }

  function bindSlideOverlayRows() {
    $$('.proposal-remove-overlay').forEach(button => {
      button.onclick = () => button.closest('.proposal-slide-overlay-row').remove();
    });
  }

  function ensureDialog() {
    let dialog = $('#serviceProposalDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'serviceProposalDialog';
    dialog.className = 'proposal-dialog';
    document.body.appendChild(dialog);
    return dialog;
  }

  async function openEditor(input) {
    const record = normalize(input || baseRecord());
    currentId = record.id || null;
    const dialog = ensureDialog();
    dialog.innerHTML = `
      <form id="serviceProposalForm">
        <div class="dialog-head">
          <div><p class="eyebrow">業務與競標</p><h3>${record.id ? '編輯' : '新增'}社區綜合服務企劃書</h3></div>
          <button type="button" class="icon-button" id="closeServiceProposal">×</button>
        </div>
        <div class="proposal-editor-note">
          <strong>ERP 內直接修改 PPT 內容</strong>
          <span>原始 42 頁版面固定保留；封面社區名稱、結語與下方新增的頁面文字會直接套入預覽及列印，LINE 官方 QR 碼也會自動放在最後一頁。</span>
        </div>
        <div class="form-grid proposal-form-grid">
          <label>企劃書編號<input name="proposal_no" required value="${esc(record.proposal_no)}"></label>
          <label>提案日期<input name="proposal_date" type="date" required value="${esc(record.proposal_date)}"></label>
          <label>連結競標報價<select name="quotation_id" id="proposalQuote"><option value="">不連結報價</option>${quotes.map(item => `<option value="${esc(item.id)}" ${item.id === record.quotation_id ? 'selected' : ''}>${esc(item.quote_no)}｜${esc(item.client_name)}｜${esc(item.project_name)}</option>`).join('')}</select></label>
          <label>連結既有案場<select name="site_id" id="proposalSite"><option value="">尚未建立案場</option>${sites.map(item => `<option value="${esc(item.id)}" ${item.id === record.site_id ? 'selected' : ''}>${esc(item.code)}｜${esc(item.name)}</option>`).join('')}</select></label>
          <label>客戶／管委會名稱<input name="client_name" required value="${esc(record.client_name)}"></label>
          <label>社區／標案名稱<input name="project_name" required value="${esc(record.project_name)}"></label>
          <label class="wide">首頁封面社區名稱（修改後直接套入第 1 頁）<input name="cover_community_name" value="${esc(record.editable_content.cover_community_name || record.project_name)}" placeholder="例如：陸光五村國宅社區"></label>
          <label class="wide">服務地址<input name="site_address" value="${esc(record.site_address)}"></label>
          <label>社區電話<input name="community_phone" value="${esc(record.community_phone)}"></label>
          <label>聯絡人<input name="contact_name" value="${esc(record.contact_name)}"></label>
          <label>聯絡電話<input name="contact_phone" value="${esc(record.contact_phone)}"></label>
          <label>社區戶數<input name="household_count" type="number" min="0" value="${esc(record.household_count)}"></label>
          <label>棟數<input name="building_count" type="number" min="0" value="${esc(record.building_count)}"></label>
          <label>預計進場日<input name="service_start_date" type="date" value="${esc(record.service_start_date)}"></label>
          <label>狀態<select name="status">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${record.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="wide">提案核心<textarea name="opening_message">${esc(record.editable_content.opening_message)}</textarea></label>
          <label class="wide">管理目標<textarea name="management_goal">${esc(record.editable_content.management_goal)}</textarea></label>
          <label class="wide">進場／交接計畫<textarea name="transition_plan">${esc(record.editable_content.transition_plan)}</textarea></label>
          <label class="wide">本案特殊需求<textarea name="special_requirements" placeholder="例如：夜班加強巡邏、指定設備點交、社區活動需求">${esc(record.editable_content.special_requirements)}</textarea></label>
          <label class="wide">費用或報價說明<textarea name="fee_note" placeholder="可填寫引用報價單、稅外加或議價說明">${esc(record.editable_content.fee_note)}</textarea></label>
          <label class="wide">結語<textarea name="closing_message">${esc(record.editable_content.closing_message)}</textarea></label>
          <label class="wide">內部備註<textarea name="note">${esc(record.note)}</textarea></label>
        </div>
        <section class="proposal-editor-section">
          <div class="panel-head"><div><h4>原始 42 頁章節</h4><span class="muted">為避免頁碼、目錄與版面跑掉，原稿章節固定完整保留。</span></div></div>
          <div class="proposal-section-checks">${sectionOptions.map(([value, label]) => `<label><input type="checkbox" name="enabled_sections" value="${value}" checked disabled>${label}</label>`).join('')}</div>
        </section>
        <section class="proposal-editor-section">
          <div class="panel-head"><div><h4>PPT 頁面直接編輯</h4><span class="muted">選擇頁碼、位置與樣式後輸入文字，會直接疊加到該頁原稿；不需要寫 JSON，也不用下載後再修改。</span></div><button id="addProposalSlideOverlay" class="mini-button" type="button">＋新增頁面文字</button></div>
          <div id="proposalSlideOverlayRows">${(record.editable_content.slide_overlays || []).map(slideOverlayRow).join('')}</div>
          <div class="proposal-qr-notice"><strong>LINE 官方 QR 碼</strong><span>已固定放在第 42 頁右側，預覽、列印與另存 PDF 都會顯示。</span></div>
        </section>
        <section class="proposal-editor-section">
          <div class="panel-head"><div><h4>本案人力配置</h4><span class="muted">職務、人數、班別時間及工作內容皆可依社區異動。</span></div><button id="addProposalStaff" class="mini-button" type="button">＋新增人力</button></div>
          <div class="proposal-staff-head"><span>職務</span><span>人數</span><span>班別／時間</span><span>主要工作</span><span>操作</span></div>
          <div id="proposalStaffRows">${record.staffing.map(staffingRow).join('')}</div>
        </section>
        <p id="serviceProposalMessage" class="form-message"></p>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" id="cancelServiceProposal">取消</button>
          <button type="button" class="btn ghost" id="previewServiceProposal">預覽企劃書</button>
          <button class="btn primary" type="submit">儲存企劃書</button>
        </div>
      </form>`;
    dialog.showModal();
    bindStaffRows();
    bindSlideOverlayRows();
    $('#closeServiceProposal').onclick = $('#cancelServiceProposal').onclick = () => dialog.close();
    $('#addProposalStaff').onclick = () => {
      $('#proposalStaffRows').insertAdjacentHTML('beforeend', staffingRow({ headcount: 1 }));
      bindStaffRows();
    };
    $('#addProposalSlideOverlay').onclick = () => {
      $('#proposalSlideOverlayRows').insertAdjacentHTML('beforeend', slideOverlayRow());
      bindSlideOverlayRows();
    };
    $('#proposalQuote').onchange = event => {
      const quote = quotes.find(item => item.id === event.target.value);
      if (!quote) return;
      const form = $('#serviceProposalForm');
      form.client_name.value = quote.client_name || form.client_name.value;
      form.project_name.value = quote.project_name || form.project_name.value;
      if (!form.cover_community_name.value) form.cover_community_name.value = quote.project_name || '';
      form.site_address.value = quote.site_address || form.site_address.value;
      form.service_start_date.value = quote.contract_start_date || form.service_start_date.value;
    };
    $('#proposalSite').onchange = event => {
      const site = sites.find(item => item.id === event.target.value);
      if (!site) return;
      const form = $('#serviceProposalForm');
      form.project_name.value = site.name || form.project_name.value;
      if (!form.cover_community_name.value) form.cover_community_name.value = site.name || '';
      form.site_address.value = site.address || form.site_address.value;
      form.community_phone.value = site.community_phone || form.community_phone.value;
      form.contact_name.value = site.chairman_name || form.contact_name.value;
      form.contact_phone.value = site.chairman_phone || form.contact_phone.value;
      form.household_count.value = site.household_count || form.household_count.value;
    };
    $('#previewServiceProposal').onclick = () => preview(collectRecord());
    $('#serviceProposalForm').onsubmit = save;
  }

  function collectRecord() {
    const form = $('#serviceProposalForm');
    const values = Object.fromEntries(new FormData(form).entries());
    return normalize({
      ...values,
      id: currentId,
      quotation_id: values.quotation_id || null,
      site_id: values.site_id || null,
      household_count: values.household_count ? Number(values.household_count) : null,
      building_count: values.building_count ? Number(values.building_count) : null,
      service_start_date: values.service_start_date || null,
      staffing: collectStaffing(),
      enabled_sections: $$('[name="enabled_sections"]:checked').map(input => input.value),
      editable_content: {
        cover_community_name: values.cover_community_name,
        opening_message: values.opening_message,
        management_goal: values.management_goal,
        transition_plan: values.transition_plan,
        special_requirements: values.special_requirements,
        fee_note: values.fee_note,
        closing_message: values.closing_message,
        slide_overlays: collectSlideOverlays()
      }
    });
  }

  async function save(event) {
    event.preventDefault();
    const message = $('#serviceProposalMessage');
    const record = collectRecord();
    if (!record.client_name || !record.project_name) {
      message.textContent = '請填寫客戶／管委會名稱及社區／標案名稱。';
      return;
    }
    if (!record.staffing.length) {
      message.textContent = '請至少填寫一項有效的人力配置。';
      return;
    }
    message.textContent = '儲存中…';
    const payload = {
      proposal_no: record.proposal_no,
      quotation_id: record.quotation_id,
      site_id: record.site_id,
      proposal_date: record.proposal_date,
      client_name: record.client_name,
      project_name: record.project_name,
      site_address: record.site_address,
      community_phone: record.community_phone,
      contact_name: record.contact_name,
      contact_phone: record.contact_phone,
      household_count: record.household_count,
      building_count: record.building_count,
      service_start_date: record.service_start_date,
      staffing: record.staffing,
      enabled_sections: record.enabled_sections,
      editable_content: record.editable_content,
      status: record.status,
      note: record.note
    };
    try {
      if (useCloud()) {
        const query = currentId
          ? client.from('community_service_proposals').update(payload).eq('id', currentId)
          : client.from('community_service_proposals').insert(payload);
        const { error } = await query;
        if (error) throw error;
      } else {
        const all = demoRows();
        const saved = { ...payload, id: currentId || crypto.randomUUID(), updated_at: new Date().toISOString() };
        saveDemo(currentId ? all.map(item => item.id === currentId ? saved : item) : [saved, ...all]);
      }
      ensureDialog().close();
      await render();
    } catch (error) {
      message.textContent = /community_service_proposals|schema cache|does not exist/i.test(error.message || '')
        ? '雲端尚未建立企劃書資料表，請先執行 migration-community-service-proposals.sql。'
        : `儲存失敗：${error.message}`;
    }
  }

  async function assetDataUrl(path, cacheName) {
    if (cacheName === 'logo' && logoDataUrl) return logoDataUrl;
    if (cacheName === 'qr' && lineQrDataUrl) return lineQrDataUrl;
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(path);
      const blob = await response.blob();
      const value = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (cacheName === 'logo') logoDataUrl = value;
      if (cacheName === 'qr') lineQrDataUrl = value;
      return value;
    } catch (_) {
      return path;
    }
  }

  const bullets = items => `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  const sectionEnabled = (row, value) => row.enabled_sections.includes(value);
  function sectionPage(title, subtitle, content) {
    return `<section class="proposal-page"><header><span>社區綜合服務企劃書</span><b>${esc(title)}</b></header><h2>${esc(subtitle)}</h2>${content}<footer>紘嘉公寓大廈管理維護股份有限公司｜專業・透明・可追蹤</footer></section>`;
  }

  const originalSectionRanges = {
    company: [5, 14],
    staffing: [15, 20],
    security: [21, 27],
    operations: [28, 35],
    digital: [36, 42]
  };
  const originalDividerPages = new Set([5, 15, 21, 28, 36]);
  const visibleOriginalPages = () => Array.from(
    { length: originalSlideCount },
    (_, index) => ({ n: index + 1 })
  );
  const cleanOriginalLines = page => page.text.split(/\r?\n/).map(line => line.trim()).filter(line =>
    line &&
    line !== '綜合服務企劃' &&
    line !== String(page.n).padStart(2, '0') &&
    line !== String(page.n) &&
    line !== '紘嘉公寓大廈管理維護股份有限公司' &&
    line !== '專業・透明・可追蹤'
  );
  const originalTitle = page => {
    const lines = cleanOriginalLines(page);
    if (originalDividerPages.has(page.n)) return lines[1] || lines[0] || '';
    if (page.n === 1) return '社區綜合服務企劃書';
    return lines[0] || '';
  };
  const originalBodyLines = page => {
    const lines = cleanOriginalLines(page);
    if (originalDividerPages.has(page.n)) return lines.slice(2).filter(line => line !== 'HONG JIA PROPERTY GROUP');
    return lines.slice(1);
  };
  const originalCopy = lines => `<div class="original-copy ${lines.length > 22 ? 'dense' : ''}">${lines.map(line =>
    `<p class="${line.length <= 10 ? 'short' : ''}">${esc(line)}</p>`
  ).join('')}</div>`;

  async function buildOriginal42PageDocument(input) {
    const row = normalize(input);
    const sourcePages = visibleOriginalPages(row);
    const [logo, qr] = await Promise.all([assetDataUrl(logoPath, 'logo'), assetDataUrl(lineQrPath, 'qr')]);
    const profile = [
      row.household_count ? `${row.household_count} 戶` : '',
      row.building_count ? `${row.building_count} 棟` : '',
      row.service_start_date ? `預計進場 ${row.service_start_date}` : ''
    ].filter(Boolean).join('｜');
    const staffingRows = row.staffing.map(item => `<tr><td>${esc(item.role_name)}</td><td>${esc(item.headcount)}</td><td>${esc(item.shift_time)}</td><td>${esc(item.responsibility)}</td></tr>`).join('');
    const pages = sourcePages.map(page => {
      if (page.n === 1) return `<section class="proposal-page proposal-cover original-page" data-original-page="1">
        <img class="proposal-logo" src="${logo}" alt="紘嘉物業">
        <p>紘嘉保全暨公寓大廈管理</p>
        <h1>社區綜合服務企劃書</h1>
        <h2>${esc(row.editable_content.cover_community_name || row.project_name)}</h2>
        <div class="gold-line"></div>
        <strong>${esc(row.client_name)}</strong>
        <p>${esc(row.site_address)}</p><p>${esc(profile)}</p>
        <div class="cover-meta"><span>企劃書編號：${esc(row.proposal_no)}</span><span>提案日期：${esc(row.proposal_date)}</span><span>第 1 頁・共 42 頁</span></div>
        <div class="cover-qr"><img src="${qr}" alt="LINE 官方 QR Code"><span>LINE 官方諮詢<br>${lineOfficialUrl}</span></div>
      </section>`;
      if (page.n === 42) return `<section class="proposal-page proposal-closing original-page" data-original-page="42">
        <img class="proposal-logo" src="${logo}" alt="紘嘉物業">
        <p class="page-marker">第 42 頁・共 42 頁</p>
        <h2>${esc(row.editable_content.closing_message)}</h2>
        <p>穩定人力｜清楚責任｜透明財務｜快速應變｜持續改善</p>
        <div class="closing-contact"><img src="${qr}" alt="LINE 官方 QR Code"><div><h3>紘嘉物業 LINE 官方</h3><p>社區如有服務諮詢、異常通知或後續聯繫，可掃描 QR Code 加入官方 LINE。</p><p>${lineOfficialUrl}</p></div></div>
        <footer>紘嘉公寓大廈管理維護股份有限公司<br>桃園市八德區高城路 23 號 1 樓｜03-283-0453</footer>
      </section>`;
      if (originalDividerPages.has(page.n)) return `<section class="proposal-page original-divider original-page" data-original-page="${page.n}">
        <span class="divider-number">${esc(cleanOriginalLines(page)[0])}</span>
        <h1>${esc(originalTitle(page))}</h1>
        <p>${esc(originalBodyLines(page).join(' '))}</p>
        <small>HONG JIA PROPERTY GROUP</small>
        <footer>第 ${page.n} 頁・共 42 頁</footer>
      </section>`;

      const additions = [];
      if (page.n === 2) additions.push(`<div class="proposal-note">${esc(row.editable_content.opening_message)}<br>${esc(row.editable_content.management_goal)}</div>`);
      if (page.n === 4 && row.editable_content.special_requirements) additions.push(`<h3>本案特殊需求</h3><div class="proposal-note">${esc(row.editable_content.special_requirements)}</div>`);
      if (page.n === 16) additions.push(`<h3>本案人力配置</h3><table class="proposal-table compact"><thead><tr><th>職務</th><th>人數</th><th>班別／時間</th><th>主要工作</th></tr></thead><tbody>${staffingRows}</tbody></table>`);
      if (page.n === 19) additions.push(`<h3>本案進場／交接計畫</h3><div class="proposal-note">${esc(row.editable_content.transition_plan)}</div>`);
      if (page.n === 31 && row.editable_content.fee_note) additions.push(`<h3>本案費用／報價說明</h3><div class="proposal-note">${esc(row.editable_content.fee_note)}</div>`);
      const lines = originalBodyLines(page);
      return `<section class="proposal-page original-page" data-original-page="${page.n}">
        <header><span>綜合服務企劃</span><b>第 ${page.n} 頁・共 42 頁</b></header>
        <h2>${esc(originalTitle(page))}</h2>
        ${originalCopy(lines)}
        ${additions.join('')}
        <footer>紘嘉公寓大廈管理維護股份有限公司｜專業・透明・可追蹤</footer>
      </section>`;
    });
    return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(row.proposal_no)} ${esc(row.project_name)}</title><style>
      @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#dfe6ec;color:#102f4d;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif}.proposal-page{width:297mm;min-height:210mm;margin:8mm auto;background:#fff;padding:14mm 18mm 12mm;position:relative;page-break-after:always;overflow:hidden}.proposal-page:last-child{page-break-after:auto}.proposal-page:after{content:"HJ";position:absolute;right:13mm;bottom:12mm;font-size:64pt;font-weight:900;color:rgba(20,50,79,.035);z-index:0}.proposal-page>*{position:relative;z-index:1}header{display:flex;justify-content:space-between;border-bottom:2px solid #d3a53b;padding-bottom:4mm;margin-bottom:8mm;font-size:10pt;letter-spacing:1px}header b{color:#168777}.proposal-page h2{font-size:24pt;margin:0 0 7mm}.proposal-page h3{font-size:13pt;margin:5mm 0 2mm}.proposal-page p,.proposal-page li,.proposal-table{font-size:10.5pt;line-height:1.55}.proposal-page footer{position:absolute;left:18mm;right:18mm;bottom:6mm;border-top:1px solid #d6dee5;padding-top:2mm;font-size:8.5pt;color:#647789}.original-copy{white-space:normal}.original-copy p{margin:0 0 2.3mm}.original-copy p.short{font-weight:800;color:#0f5f6c}.original-copy.dense{columns:2;column-gap:14mm;column-rule:1px solid #d7e0e7}.original-copy.dense p{break-inside:avoid;margin-bottom:1.5mm;font-size:9.5pt;line-height:1.4}.original-divider{display:grid;place-content:center;text-align:center;background:linear-gradient(135deg,#0f2d49,#174d67);color:#fff}.original-divider:after{color:rgba(255,255,255,.035)}.original-divider .divider-number{font-size:22pt;color:#d3a53b;font-weight:900}.original-divider h1{font-size:36pt;margin:5mm 0}.original-divider p{font-size:16pt}.original-divider small{color:#d3a53b;letter-spacing:3px}.original-divider footer{color:#d9e4ec;border-color:#668094}.proposal-cover{background:linear-gradient(120deg,#fff 0 66%,#eef4f7 66%);padding-top:18mm}.proposal-cover:before{content:"";position:absolute;inset:0 0 auto;height:10mm;background:#0f2d49;border-bottom:2mm solid #d3a53b}.proposal-logo{width:42mm;height:24mm;object-fit:contain;object-position:left center}.proposal-cover>p:first-of-type{font-size:13pt;letter-spacing:3px}.proposal-cover h1{font-size:36pt;margin:16mm 0 5mm}.proposal-cover h2{font-size:26pt}.gold-line{width:65mm;border-top:3px solid #d3a53b;margin:8mm 0}.cover-meta{position:absolute;left:18mm;bottom:20mm;display:flex;gap:14mm;font-size:9.5pt}.cover-qr{position:absolute;right:18mm;bottom:18mm;display:flex;align-items:center;gap:5mm}.cover-qr img{width:28mm;height:28mm}.cover-qr span{font-size:10pt;line-height:1.5}.proposal-note{padding:4mm 5mm;background:#edf5f7;border-left:4px solid #168777;white-space:pre-wrap;line-height:1.6}.proposal-table{width:100%;border-collapse:collapse}.proposal-table th,.proposal-table td{border:1px solid #cbd6de;padding:2.2mm;text-align:left;vertical-align:top}.proposal-table th{background:#eef3f6;white-space:nowrap}.proposal-table.compact{font-size:9pt}.proposal-closing{background:#0f2d49;color:#fff;padding-top:22mm}.proposal-closing:after{color:rgba(255,255,255,.03)}.proposal-closing .proposal-logo{background:#fff;border-radius:2mm;padding:2mm}.proposal-closing h2{font-size:28pt;max-width:220mm;margin-top:20mm}.proposal-closing>p{color:#d3a53b;letter-spacing:2px}.proposal-closing footer{color:#dbe5ec;border-color:#5d7182}.page-marker{position:absolute;right:18mm;top:14mm;color:#d3a53b}.closing-contact{display:flex;align-items:center;gap:8mm;margin-top:18mm;border:1px solid #607589;padding:6mm;width:155mm}.closing-contact img{width:34mm;height:34mm;background:#fff}.closing-contact h3{margin:0 0 2mm}.closing-contact p{font-size:10pt;margin:1mm 0}@media print{body{background:#fff}.proposal-page{margin:0;width:297mm;height:210mm;min-height:210mm}.proposal-actions{display:none}}
    </style></head><body>${pages.join('')}</body></html>`;
  }

  async function buildDocument(input) {
    const exactRow = normalize(input);
    const editable = exactRow.editable_content || {};
    const customOverlays = Array.isArray(editable.slide_overlays) ? editable.slide_overlays : [];
    const qrUrl = new URL(lineQrPath, window.location.href).href;
    const exactPages = visibleOriginalPages().map(page => {
      const overlays = customOverlays.filter(item => Number(item.page) === page.n && item.text).map(item =>
        `<div class="slide-overlay overlay-${esc(item.position)} overlay-style-${esc(item.style)}">${esc(item.text)}</div>`
      );
      if (page.n === 1 && (editable.cover_community_name || exactRow.project_name)) {
        overlays.unshift(`<div class="cover-name-replacement"><span>${esc(editable.cover_community_name || exactRow.project_name)}</span></div>`);
      }
      if (page.n === 42) {
        overlays.push(`<div class="closing-editable-message">${esc(editable.closing_message || '')}</div>`);
        overlays.push(`<div class="official-line-qr"><img src="${qrUrl}" alt="紘嘉 LINE 官方帳號 QR 碼"><strong>LINE 官方帳號</strong><span>掃描加入好友<br>諮詢・通知・聯絡</span></div>`);
      }
      return `
      <section class="proposal-page original-slide-page" data-original-page="${page.n}" aria-label="第 ${page.n} 頁，共 ${originalSlideCount} 頁">
        <img class="original-slide-image" src="${originalSlidePath(page.n)}" alt="社區綜合服務企劃書第 ${page.n} 頁" draggable="false">
        ${overlays.join('')}
        <span class="sr-only">第 ${page.n} 頁，共 ${originalSlideCount} 頁</span>
      </section>`;
    }).join('');
    return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8">
      <title>${esc(exactRow.proposal_no)} ${esc(exactRow.project_name)}｜原始 42 頁企劃書</title>
      <style>
        @page{size:297mm 167.0625mm;margin:0}
        *{box-sizing:border-box}
        html,body{margin:0;background:#172535}
        body{font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif}
        .proposal-page{width:297mm;height:167.0625mm;margin:8mm auto;background:#fff;position:relative;overflow:hidden;page-break-after:always;break-after:page}
        .proposal-page:last-child{page-break-after:auto;break-after:auto}
        .original-slide-image{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#fff}
        .cover-name-replacement{position:absolute;left:24%;top:36.5%;width:48%;height:16%;display:flex;align-items:center;justify-content:center;padding:1.5% 2%;background:rgba(255,255,255,.94);border-top:4px solid #f5bf00;border-bottom:4px solid #f5bf00;color:#080808;font-family:DFKai-SB,"BiauKai","Microsoft JhengHei",serif;font-size:42px;font-weight:700;text-align:center;line-height:1.15}
        .cover-name-replacement:before,.cover-name-replacement:after{content:"◆";position:absolute;left:50%;transform:translateX(-50%);color:#f5bf00;font-size:20px;background:#fff;padding:0 7px}
        .cover-name-replacement:before{top:-14px}.cover-name-replacement:after{bottom:-14px}
        .slide-overlay{position:absolute;z-index:3;max-width:44%;padding:1.6% 2%;white-space:pre-wrap;line-height:1.55;font-size:21px;box-shadow:0 3px 12px rgba(7,33,58,.12)}
        .overlay-top_left{left:5.8%;top:16%}.overlay-top_right{right:5.8%;top:16%}.overlay-center{left:50%;top:50%;transform:translate(-50%,-50%)}.overlay-bottom_left{left:5.8%;bottom:8%}.overlay-bottom_right{right:5.8%;bottom:8%}
        .overlay-style-title{max-width:80%;padding:.8% 1.5%;background:rgba(255,255,255,.95);border-bottom:4px solid #d8a43f;color:#0b2946;font-size:34px;font-weight:800}
        .overlay-style-note{background:rgba(255,255,255,.96);border:1px solid #d5e0e8;border-left:6px solid #16877c;color:#173651}
        .overlay-style-dark{background:rgba(8,38,65,.96);border-left:6px solid #d9aa4b;color:#fff;font-weight:700}
        .overlay-style-plain{background:transparent;box-shadow:none;color:#0b2946;font-weight:700;text-shadow:0 1px 2px #fff}
        .closing-editable-message{position:absolute;left:7%;top:37%;width:65%;padding:1.5% 0;background:#092642;color:#fff;font-size:33px;font-weight:800;line-height:1.45}
        .official-line-qr{position:absolute;right:7%;top:22%;width:17%;padding:1.1%;background:#fff;border-radius:14px;display:flex;flex-direction:column;align-items:center;text-align:center;color:#092642;box-shadow:0 8px 28px rgba(0,0,0,.26)}
        .official-line-qr img{display:block;width:100%;height:auto;background:#fff}
        .official-line-qr strong{font-size:19px;margin-top:6px}.official-line-qr span{font-size:13px;line-height:1.45;margin-top:3px}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        .proposal-actions{position:fixed;right:14px;top:14px;z-index:99;display:flex;gap:8px;padding:8px;background:rgba(15,45,73,.92);border-radius:10px}
        .proposal-actions button{border:0;border-radius:7px;padding:10px 14px;font-weight:700;cursor:pointer}
        @media print{
          html,body{background:#fff}
          .proposal-page{margin:0;width:297mm;height:167.0625mm}
          .proposal-actions{display:none!important}
        }
      </style></head><body>${exactPages}</body></html>`;
    const row = normalize(input);
    const [logo, qr] = await Promise.all([assetDataUrl(logoPath, 'logo'), assetDataUrl(lineQrPath, 'qr')]);
    const staffingRows = row.staffing.map(item => `<tr><td>${esc(item.role_name)}</td><td>${esc(item.headcount)}</td><td>${esc(item.shift_time)}</td><td>${esc(item.responsibility)}</td></tr>`).join('');
    const profile = [
      row.household_count ? `戶數：${row.household_count} 戶` : '',
      row.building_count ? `棟數：${row.building_count} 棟` : '',
      row.service_start_date ? `預計進場：${row.service_start_date}` : ''
    ].filter(Boolean).join('　');
    const pages = [];

    pages.push(`<section class="proposal-page proposal-cover">
      <img class="proposal-logo" src="${logo}" alt="紘嘉物業">
      <p>紘嘉保全暨公寓大廈管理</p>
      <h1>社區綜合服務企劃書</h1>
      <h2>${esc(row.editable_content.cover_community_name || row.project_name)}</h2>
      <div class="gold-line"></div>
      <strong>${esc(row.client_name)}</strong>
      <p>${esc(row.site_address)}</p>
      <p>${esc(profile)}</p>
      <div class="cover-meta"><span>企劃書編號：${esc(row.proposal_no)}</span><span>提案日期：${esc(row.proposal_date)}</span></div>
      <div class="cover-qr"><img src="${qr}" alt="LINE 官方 QR Code"><span>LINE 官方諮詢<br>${lineOfficialUrl}</span></div>
    </section>`);

    pages.push(sectionPage('提案總覽', row.editable_content.opening_message, `
      <div class="proposal-lead">${esc(row.editable_content.management_goal)}</div>
      <div class="proposal-three"><article><b>穩定接手</b><p>人力、交接、排班與備援同時到位，降低換約期間服務落差。</p></article><article><b>透明管理</b><p>勤務、財務、修繕與申訴都有紀錄及責任歸屬。</p></article><article><b>持續改善</b><p>以月報、稽核與例會追蹤問題，讓服務品質持續提升。</p></article></div>
      <h3>本案基本資料</h3><table class="proposal-table"><tr><th>社區／案場</th><td>${esc(row.project_name)}</td><th>客戶／管委會</th><td>${esc(row.client_name)}</td></tr><tr><th>地址</th><td colspan="3">${esc(row.site_address || '—')}</td></tr><tr><th>社區電話</th><td>${esc(row.community_phone || '—')}</td><th>聯絡窗口</th><td>${esc([row.contact_name, row.contact_phone].filter(Boolean).join('／') || '—')}</td></tr></table>
      ${row.editable_content.special_requirements ? `<h3>本案特殊需求</h3><div class="proposal-note">${esc(row.editable_content.special_requirements)}</div>` : ''}`));

    if (sectionEnabled(row, 'company')) pages.push(sectionPage('01 公司能力與治理', '以物業管理為核心，整合保全、清潔、機電與行政支援', `
      <div class="proposal-two"><article><h3>紘嘉公寓大廈管理維護股份有限公司</h3><p>統一編號 70409141</p>${bullets(['總幹事與行政管理', '財務、合約及會議支援', '修繕、清潔與廠商協調'])}</article><article><h3>紘嘉保全股份有限公司</h3><p>統一編號 94012985</p>${bullets(['駐點保全與勤務督導', '門禁、巡邏與緊急應變', '教育訓練與後勤備援'])}</article></div>
      <h3>單一窗口、後端分工</h3><p>總幹事作為社區與公司的單一責任窗口，後端由勤務督導、行政財務、機電清潔及法務風險支援，重大事件可持續追蹤到結案。</p>
      <div class="proposal-process"><span>管委會</span><i>→</i><span>總幹事</span><i>→</i><span>24H 管理中心</span><i>→</i><span>專業後勤</span></div>
      <h3>治理原則</h3>${bullets(['決策有層級、專業有分工、重大事件有後援', '品質制度、現場稽核、教育訓練與數位紀錄並行', '服務範圍涵蓋桃園、新北及新竹地區'])}`));

    if (sectionEnabled(row, 'staffing')) pages.push(sectionPage('02 人力配置與進場', '接手成功的關鍵，在於人員、交接、排班與備援同時準備', `
      <h3>本案人力配置</h3><table class="proposal-table"><thead><tr><th>職務</th><th>人數</th><th>班別／時間</th><th>主要工作</th></tr></thead><tbody>${staffingRows}</tbody></table>
      <h3>進場與交接計畫</h3><div class="proposal-note">${esc(row.editable_content.transition_plan)}</div>
      <div class="proposal-steps"><article><b>準備</b><p>人力招募、資格確認、現勘、班表與備援名單。</p></article><article><b>接手</b><p>財務文件、設備、鑰匙、資產與現場動線點交。</p></article><article><b>穩定</b><p>勤務標準落地、缺失清單與住戶需求分類。</p></article><article><b>改善</b><p>提出首月報告、調整 SOP 與後續優先順序。</p></article></div>
      <p class="proposal-callout">跨日夜班、臨時缺員及交接內容均在排班前納入設計，所有班別記錄上班時間、下班時間、跨日歸屬與交接事項。</p>`));

    if (sectionEnabled(row, 'security')) pages.push(sectionPage('03 安全勤務與日常秩序', '把高頻工作寫成標準流程，異常發生時才有一致反應', `
      <div class="proposal-two"><article><h3>門禁與車輛</h3>${bullets(['確認身分、來意與授權', '記錄時間、去向及離場狀態', '住戶、訪客與廠商採不同管理程序'])}</article><article><h3>巡邏與包裹</h3>${bullets(['依風險、時段及設備配置巡邏', '重大缺失附照片、位置與處理狀態', '包裹收件、登記、通知、領取與異常追蹤'])}</article></div>
      <h3>緊急事件處理</h3><div class="proposal-process"><span>發現</span><i>→</i><span>分級</span><i>→</i><span>處置</span><i>→</i><span>回報</span><i>→</i><span>改善</span><i>→</i><span>結案</span></div>
      <div class="proposal-three"><article><b>火災／煙霧</b><p>警示、通報、疏散與消防設備協助。</p></article><article><b>治安／衝突</b><p>保持安全距離、通知警政並保留影像。</p></article><article><b>傷病／意外</b><p>急救協助、聯絡 119 並引導救護動線。</p></article></div>
      <p class="proposal-callout">先處理風險，再處理責任；先保留事證，再判斷原因；先完成通報，再追蹤改善。</p>`));

    if (sectionEnabled(row, 'operations')) pages.push(sectionPage('04 社區營運與財務透明', '設備、清潔與每一筆收支都要有依據、流程與核准者', `
      <div class="proposal-three"><article><b>設備管理</b>${bullets(['設備清冊', '例行巡檢', '預防保養', '異常修繕與驗收'])}</article><article><b>清潔管理</b>${bullets(['高頻區每日巡查', '公共區依排程清潔', '專案區依週期安排', '以照片及標準驗收'])}</article><article><b>財務管理</b>${bullets(['收入與支出分類', '憑證及附件留存', '依權限完成簽核', '每月收支與異常報告'])}</article></div>
      <h3>修繕與採購流程</h3><div class="proposal-process"><span>提報</span><i>→</i><span>分級</span><i>→</i><span>估價</span><i>→</i><span>核准</span><i>→</i><span>施工</span><i>→</i><span>驗收</span></div>
      <h3>年度工作規劃</h3><table class="proposal-table"><tr><th>第一季</th><td>制度、合約、設備與消防盤點</td><th>第二季</th><td>清潔專案、環境改善與防汛</td></tr><tr><th>第三季</th><td>防災、訓練與安全強化</td><th>第四季</th><td>年度檢討、預算與次年計畫</td></tr></table>
      ${row.editable_content.fee_note ? `<h3>本案費用／報價說明</h3><div class="proposal-note">${esc(row.editable_content.fee_note)}</div>` : ''}`));

    if (sectionEnabled(row, 'digital')) pages.push(sectionPage('05 數位管理與品質稽核', '讓每一項工作都能被查詢、追蹤與改善', `
      <div class="proposal-two"><article><h3>紘嘉 ERP 與員工端</h3>${bullets(['勤務排班：班別、時間、跨日與備援', '打卡巡查：定位、時間與異常回報', '請假交接：審核、時數與交接事項', '管理追蹤：提醒、紀錄與權限控管'])}</article><article><h3>教育訓練</h3>${bullets(['新進訓練與在職複訓', '門禁、巡邏、服儀與交接', 'CPR、AED、火警及疏散協助', '缺失回訓保留簽到與內容紀錄'])}</article></div>
      <h3>三級品質回饋</h3><div class="proposal-process"><span>每日現場自查</span><i>→</i><span>每週督導抽查</span><i>→</i><span>每月管理檢討</span></div>
      <h3>住戶反映閉環</h3><div class="proposal-process"><span>受理</span><i>→</i><span>分類</span><i>→</i><span>處理</span><i>→</i><span>追蹤</span></div>
      <p class="proposal-callout">系統只是工具，真正目的，是確認標準是否清楚、資源是否足夠、問題是否結案。</p>`));

    pages.push(`<section class="proposal-page proposal-closing">
      <img class="proposal-logo" src="${logo}" alt="紘嘉物業">
      <h2>${esc(row.editable_content.closing_message)}</h2>
      <p>穩定人力｜清楚責任｜透明財務｜快速應變｜持續改善</p>
      <div class="closing-contact"><img src="${qr}" alt="LINE 官方 QR Code"><div><h3>紘嘉物業 LINE 官方</h3><p>社區如有服務諮詢、異常通知或後續聯繫，可掃描 QR Code 加入官方 LINE。</p><p>${lineOfficialUrl}</p></div></div>
      <footer>紘嘉公寓大廈管理維護股份有限公司<br>桃園市八德區高城路 23 號 1 樓｜03-283-0453</footer>
    </section>`);

    return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(row.proposal_no)} ${esc(row.project_name)}</title><style>
      @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#dfe6ec;color:#102f4d;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif}.proposal-page{width:297mm;min-height:210mm;margin:8mm auto;background:#fff;padding:14mm 18mm 12mm;position:relative;page-break-after:always;overflow:hidden}.proposal-page:last-child{page-break-after:auto}.proposal-page:after{content:"HJ";position:absolute;right:13mm;bottom:12mm;font-size:64pt;font-weight:900;color:rgba(20,50,79,.035);z-index:0}.proposal-page>*{position:relative;z-index:1}header{display:flex;justify-content:space-between;border-bottom:2px solid #d3a53b;padding-bottom:4mm;margin-bottom:8mm;font-size:10pt;letter-spacing:1px}header b{color:#168777}.proposal-page h2{font-size:24pt;margin:0 0 8mm}.proposal-page h3{font-size:15pt;margin:7mm 0 3mm}.proposal-page p,.proposal-page li,.proposal-table{font-size:11.5pt;line-height:1.75}.proposal-page footer{position:absolute;left:18mm;right:18mm;bottom:6mm;border-top:1px solid #d6dee5;padding-top:2mm;font-size:8.5pt;color:#647789}.proposal-cover{background:linear-gradient(120deg,#fff 0 66%,#eef4f7 66%);padding-top:18mm}.proposal-cover:before{content:"";position:absolute;inset:0 0 auto;height:10mm;background:#0f2d49;border-bottom:2mm solid #d3a53b}.proposal-logo{width:42mm;height:24mm;object-fit:contain;object-position:left center}.proposal-cover>p:first-of-type{font-size:13pt;letter-spacing:3px}.proposal-cover h1{font-size:36pt;margin:16mm 0 5mm}.proposal-cover h2{font-size:26pt}.gold-line{width:65mm;border-top:3px solid #d3a53b;margin:8mm 0}.cover-meta{position:absolute;left:18mm;bottom:20mm;display:flex;gap:20mm;font-size:10pt}.cover-qr{position:absolute;right:18mm;bottom:18mm;display:flex;align-items:center;gap:5mm}.cover-qr img{width:28mm;height:28mm}.cover-qr span{font-size:10pt;line-height:1.5}.proposal-lead,.proposal-note,.proposal-callout{padding:5mm 6mm;background:#edf5f7;border-left:4px solid #168777;white-space:pre-wrap;line-height:1.8}.proposal-callout{background:#0f2d49;color:#fff;border-left-color:#d3a53b;margin-top:7mm}.proposal-two,.proposal-three,.proposal-steps{display:grid;gap:6mm}.proposal-two{grid-template-columns:repeat(2,1fr)}.proposal-three{grid-template-columns:repeat(3,1fr)}.proposal-steps{grid-template-columns:repeat(4,1fr)}.proposal-two article,.proposal-three article,.proposal-steps article{border:1px solid #d9e1e7;padding:5mm;border-top:3px solid #d3a53b}.proposal-three b,.proposal-steps b{font-size:14pt}.proposal-table{width:100%;border-collapse:collapse}.proposal-table th,.proposal-table td{border:1px solid #cbd6de;padding:3mm;text-align:left;vertical-align:top}.proposal-table th{background:#eef3f6;white-space:nowrap}.proposal-process{display:flex;align-items:center;justify-content:center;gap:4mm;margin:6mm 0}.proposal-process span{background:#0f2d49;color:#fff;padding:4mm 5mm;border-radius:2mm;font-weight:700}.proposal-process i{font-style:normal;color:#d3a53b;font-size:18pt}.proposal-closing{background:#0f2d49;color:#fff;padding-top:22mm}.proposal-closing:after{color:rgba(255,255,255,.03)}.proposal-closing .proposal-logo{background:#fff;border-radius:2mm;padding:2mm}.proposal-closing h2{font-size:28pt;max-width:220mm;margin-top:20mm}.proposal-closing>p{color:#d3a53b;letter-spacing:2px}.proposal-closing footer{color:#dbe5ec;border-color:#5d7182}.closing-contact{display:flex;align-items:center;gap:8mm;margin-top:18mm;border:1px solid #607589;padding:6mm;width:155mm}.closing-contact img{width:34mm;height:34mm;background:#fff}.closing-contact h3{margin:0 0 2mm}.closing-contact p{font-size:10pt;margin:1mm 0}@media print{body{background:#fff}.proposal-page{margin:0;width:297mm;height:210mm;min-height:210mm}.proposal-actions{display:none}}
    </style></head><body>${pages.join('')}</body></html>`;
  }

  async function preview(row) {
    const old = $('#serviceProposalPreviewDialog');
    if (old) old.remove();
    const previewDialog = document.createElement('dialog');
    previewDialog.id = 'serviceProposalPreviewDialog';
    previewDialog.setAttribute('aria-label', '社區綜合服務企劃書預覽');
    previewDialog.style.cssText = 'width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;overflow:hidden';
    const frame = document.createElement('iframe');
    frame.id = 'serviceProposalFrame';
    frame.title = '社區綜合服務企劃書預覽';
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#fff';
    previewDialog.appendChild(frame);
    document.body.appendChild(previewDialog);
    previewDialog.showModal();
    const html = await buildDocument(row);
    frame.srcdoc = html.replace('<body>', '<body><div class="proposal-actions"><button onclick="parent.document.getElementById(\'serviceProposalPreviewDialog\').remove()">關閉預覽</button><button onclick="Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=img.onerror=resolve}))).then(()=>window.print())">列印／另存 PDF</button></div>');
  }

  async function download(row) {
    const response = await fetch(new URL(originalPptPath, window.location.href).href, { cache: 'no-store' });
    if (!response.ok) throw new Error('原始 PPT 下載失敗，請稍後再試。');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFile(`${row.proposal_no}_${row.project_name || '社區綜合服務企劃書'}`)}.pptx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function remove(id) {
    if (!confirm('確定永久刪除這份企劃書？此動作無法復原。')) return;
    if (useCloud()) {
      const { error } = await client.from('community_service_proposals').delete().eq('id', id);
      if (error) return alert(`刪除失敗：${error.message}`);
    } else {
      saveDemo(demoRows().filter(item => item.id !== id));
    }
    await render();
  }

  async function render() {
    const content = $('#content');
    content.innerHTML = '<article class="panel empty">載入社區企劃書中…</article>';
    try {
      [rows, quotes, sites] = await Promise.all([listProposals(), listQuotes(), listSites()]);
      rows = rows.map(normalize);
      content.innerHTML = `
        <article class="panel proposal-manager">
          <div class="panel-head">
            <div><p class="eyebrow">業務與競標</p><h3>社區綜合服務企劃書</h3><span class="muted">直接在 ERP 修改封面、結語及指定頁文字；預覽、列印與 PDF 會立即套用，並保留原始 42 頁版面。</span></div>
            <button class="btn primary" id="addServiceProposal">＋新增企劃書</button>
          </div>
          <div class="proposal-storage-note"><strong>原稿保真模式</strong><span>42 頁原稿只共用一份，僅在開啟預覽時載入，不會重複存入每筆企劃書，也不影響 ERP 平常操作。</span></div>
          <div class="table-wrap"><table><thead><tr><th>企劃書編號</th><th>客戶／社區</th><th>提案日期</th><th>人力配置</th><th>頁數</th><th>狀態</th><th>操作</th></tr></thead><tbody>
            ${rows.length ? rows.map(row => `<tr><td><strong>${esc(row.proposal_no)}</strong></td><td>${esc(row.client_name)}<small>${esc(row.project_name)}</small></td><td>${esc(row.proposal_date)}</td><td>${row.staffing.reduce((sum, item) => sum + Number(item.headcount || 0), 0)} 人<small>${row.staffing.map(item => item.role_name).join('、')}</small></td><td>${originalSlideCount} 頁</td><td><span class="badge">${esc(statusLabels[row.status] || row.status)}</span></td><td><div class="action-row"><button class="mini-button" data-p-edit="${row.id}">ERP 內編輯</button><button class="mini-button" data-p-preview="${row.id}">預覽／列印</button><button class="mini-button" data-p-download="${row.id}">原始 PPT 備份</button><button class="mini-button danger" data-p-delete="${row.id}">刪除</button></div></td></tr>`).join('') : '<tr><td colspan="7" class="empty">尚無企劃書，請按右上角新增。</td></tr>'}
          </tbody></table></div>
        </article>`;
      $('#addServiceProposal').onclick = () => openEditor(null);
      $$('[data-p-edit]').forEach(button => button.onclick = () => openEditor(rows.find(row => row.id === button.dataset.pEdit)));
      $$('[data-p-preview]').forEach(button => button.onclick = () => preview(rows.find(row => row.id === button.dataset.pPreview)));
      $$('[data-p-download]').forEach(button => button.onclick = () => download(rows.find(row => row.id === button.dataset.pDownload)));
      $$('[data-p-delete]').forEach(button => button.onclick = () => remove(button.dataset.pDelete));
    } catch (error) {
      content.innerHTML = `<article class="panel empty">載入失敗：${esc(error.message)}<br><small>若雲端尚未建立企劃書資料表，請先執行 migration-community-service-proposals.sql。</small></article>`;
    }
  }

  window.ServiceProposals = { render, openFromQuotation: async id => {
    [quotes, sites] = await Promise.all([listQuotes(), listSites()]);
    const quote = quotes.find(item => item.id === id) || {};
    await openEditor(baseRecord({ quote }));
  }};
})();
