(() => {
  'use strict';
  const HISTORY_SHEET = '補打卡申請明細';
  const DAY_MS = 86400000;
  const text = value => String(value ?? '');
  const statusText = value => ({normal:'正常',late:'遲到',missing:'缺卡',pending:'待審核',approved:'已核准',rejected:'已退回'}[value] || value || '—');
  const dateCell = (value, dateOnly = false) => {
    if (!value) return '';
    const stamp = Date.parse(dateOnly ? `${text(value).slice(0,10)}T00:00:00Z` : value);
    if (!Number.isFinite(stamp)) return '';
    return {t:'n',v:(stamp + (dateOnly ? 0 : 8 * 3600000)) / DAY_MS + 25569,z:dateOnly ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm'};
  };
  const hours = row => row.clock_in && row.clock_out
    ? Math.max(0, (Date.parse(row.clock_out) - Date.parse(row.clock_in)) / 3600000) || 0 : 0;
  const gps = (lat,lng) => lat != null && lng != null ? `${lat}, ${lng}` : '—';
  function uniqueSheetName(label, used) {
    const base = text(label).replace(/[\[\]:*?/\\\x00-\x1f]/g,'_').replace(/^'+|'+$/g,'').trim() || '員工';
    let suffix = '', name = base.slice(0,31);
    for (let n=2; used.has(name.toLowerCase()); n++) {
      suffix = ` (${n})`;
      name = base.slice(0,31-suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  }
  function createSheet(XLSX, grid, widths, lastDataRow) {
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    sheet['!cols'] = widths.map(wch => ({wch}));
    sheet['!merges'] = [0,4].map(r => ({s:{r,c:0},e:{r,c:widths.length-1}}));
    sheet['!rows'] = grid.map((_,r) => ({hpt:r===0?28:r===4?30:24}));
    sheet['!autofilter'] = {ref:XLSX.utils.encode_range({s:{r:5,c:0},e:{r:Math.max(5,lastDataRow),c:widths.length-1}})};
    return sheet;
  }
  function buildWorkbook(XLSX, {rows=[],corrections=[],employees=[],site,month}) {
    const workbook = XLSX.utils.book_new();
    const used = new Set([HISTORY_SHEET.toLowerCase()]);
    const people = new Map(employees.map(employee => [employee.id,employee]));
    const groups = new Map();
    for (const row of [...rows,...corrections]) {
      const key = row.employee_id || `unknown:${row.id}`;
      if (!groups.has(key)) groups.set(key,{employee:{...people.get(row.employee_id),...row.employees},rows:[]});
    }
    for (const row of rows) groups.get(row.employee_id || `unknown:${row.id}`).rows.push(row);
    const sorted = [...groups.values()].sort((a,b) => text(a.employee.employee_no).localeCompare(text(b.employee.employee_no),'zh-TW',{numeric:true}) || text(a.employee.full_name).localeCompare(text(b.employee.full_name),'zh-TW'));
    for (const group of sorted) {
      const person = group.employee;
      const records = [...group.rows].sort((a,b) => text(a.work_date).localeCompare(text(b.work_date)) || text(a.clock_in).localeCompare(text(b.clock_in)));
      const grid = [
        ['個人打卡紀錄'],
        ['案場',text(site?.name),'月份',month],
        ['工號',text(person.employee_no),'姓名',text(person.full_name || '未知員工')],
        ['打卡筆數',records.length,'完整上下班',records.filter(row=>row.clock_in&&row.clock_out).length,'缺卡／異常',records.filter(row=>!row.clock_in||!row.clock_out||row.status==='missing').length],
        ['時間以台灣時間顯示；此頁為正式打卡紀錄，補申請與審核情形請見「補打卡申請明細」。'],
        ['出勤日期','上班時間','下班時間','值勤時數','狀態','上班 GPS','下班 GPS'],
        ...records.map((row,index) => {
          const r = index + 7;
          return [dateCell(row.work_date,true),dateCell(row.clock_in),dateCell(row.clock_out),{t:'n',v:hours(row),f:`IF(OR(B${r}="",C${r}=""),0,MAX(0,(C${r}-B${r})*24))`,z:'0.0'},statusText(row.status),gps(row.clock_in_lat,row.clock_in_lng),gps(row.clock_out_lat,row.clock_out_lng)];
        })
      ];
      if (!records.length) grid.push(['本月尚無正式打卡紀錄']);
      grid.push(['總值勤時數','','',{t:'n',v:records.reduce((sum,row)=>sum+hours(row),0),...(records.length?{f:`SUM(D7:D${records.length+6})`}:{}),z:'0.0'}]);
      const sheet = createSheet(XLSX,grid,[15,23,23,13,16,29,29],records.length+5);
      if (!records.length) sheet['!merges'].push({s:{r:6,c:0},e:{r:6,c:6}});
      XLSX.utils.book_append_sheet(workbook,sheet,uniqueSheetName(`${person.employee_no||''}－${person.full_name||'未知員工'}`,used));
    }
    const history = [...corrections].sort((a,b) => text(b.requested_at||b.corrected_at).localeCompare(text(a.requested_at||a.corrected_at)));
    const historyGrid = [
      [HISTORY_SHEET],
      ['案場',text(site?.name),'月份',month],
      ['申請筆數',history.length,'待審核',history.filter(row=>row.approval_status==='pending').length],
      ['包含待審核、已核准與已退回的申請'],
      ['依出勤日期篩選月份，時間以台灣時間顯示；補申請核准前不會改動正式打卡紀錄。'],
      ['狀態','出勤日期','工號','姓名','原上班時間','原下班時間','申請上班時間','申請下班時間','補打卡原因','申請時間','審核時間','審核備註'],
      ...history.map(row => {
        const person = {...people.get(row.employee_id),...row.employees},status=row.approval_status||'approved';
        return [statusText(status),dateCell(row.work_date,true),text(person.employee_no),text(person.full_name||'未知員工'),dateCell(row.old_clock_in),dateCell(row.old_clock_out),dateCell(row.corrected_clock_in),dateCell(row.corrected_clock_out),text(row.reason),dateCell(row.requested_at||row.corrected_at),status==='pending'?'':dateCell(row.reviewed_at||row.corrected_at),text(row.review_note)];
      })
    ];
    if (!history.length) historyGrid.push(['本月尚無補打卡申請']);
    const historySheet = createSheet(XLSX,historyGrid,[14,15,14,18,23,23,23,23,55,23,23,55],history.length+5);
    if (!history.length) historySheet['!merges'].push({s:{r:6,c:0},e:{r:6,c:11}});
    XLSX.utils.book_append_sheet(workbook,historySheet,HISTORY_SHEET);
    return workbook;
  }
  async function loadAll(client, table, siteId, first, last) {
    const rows=[];
    for (let offset=0; ; offset+=1000) {
      const {data,error} = await client.from(table).select('*,employees(employee_no,full_name)')
        .eq('site_id',siteId).gte('work_date',first).lte('work_date',last)
        .order('work_date').order('id').range(offset,offset+999);
      if (error) throw new Error(`${table==='attendance'?'打卡紀錄':'補申請明細'}讀取失敗：${error.message}`);
      rows.push(...(data||[]));
      if (!data || data.length<1000) return rows;
    }
  }
  async function download(config) {
    const {site,month,range,button,notice} = config;
    if (!site?.id) return notice('請先選擇案場。','error');
    if (button?.disabled) return;
    const label=button?.textContent;
    if (button) {button.disabled=true;button.textContent='正在製作 Excel…';}
    try {
      const XLSX=await window.ERP_LAZY_LIBS.xlsx();
      const filter=list=>list.filter(row=>row.site_id===site.id&&row.work_date>=range.first&&row.work_date<=range.last);
      const [rows,corrections]=config.cloudEnabled
        ? await Promise.all(['attendance','attendance_corrections'].map(table=>loadAll(config.client,table,site.id,range.first,range.last)))
        : await Promise.all(['attendance','attendance_corrections'].map(async table=>filter(await config.db.list(table))));
      if (!rows.length&&!corrections.length) return notice('此案場本月沒有打卡紀錄或補打卡申請可下載。','error');
      const workbook=buildWorkbook(XLSX,{rows,corrections,employees:config.employees,site,month});
      const safe=text(site.name||'案場').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');
      XLSX.writeFile(workbook,`${month}_${safe}_打卡紀錄.xlsx`,{bookType:'xlsx',compression:true});
      notice('Excel 已下載：每位員工各一分頁，另附補打卡申請明細。','success');
    } catch (error) {
      notice(`下載失敗：${error.message}`,'error');
    } finally {
      if (button) {button.disabled=false;button.textContent=label;}
    }
  }
  window.AttendanceExport={buildWorkbook,download,loadAll};
})();
