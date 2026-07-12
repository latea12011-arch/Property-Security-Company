(() => {
  'use strict';

  const config = window.ERP_CONFIG || {};
  const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = cloudEnabled ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const demoKey = 'hongjia_erp_demo_v1';

  const viewInfo = {
    dashboard: ['營運總覽', 'dashboard'], employees: ['員工管理', 'employees'], sites: ['案場管理', 'sites'],
    schedules: ['勤務排班', 'schedules'], attendance: ['打卡紀錄', 'attendance'], supervisorInspections: ['督導巡查', 'supervisor_inspections'], leaves: ['請假審核', 'leave_requests'], complaints: ['反霸凌申訴', 'bullying_complaints'], payrollProfiles: ['薪資設定', 'employee_payroll_profiles'], advances: ['員工借支', 'salary_advances'], payroll: ['薪資明細', 'payroll_records'], terminations: ['離職證明', 'termination_certificates'], tenderQuotations: ['競標合約報價', 'tender_quotations'], vendors: ['合作廠商', 'vendors'], inventoryItems: ['庫存物品', 'inventory_items'], inventoryTransactions: ['入庫／領用紀錄', 'inventory_transactions'], auditLogs: ['操作紀錄', 'audit_logs'], announcements: ['公告管理','announcements']
  };
  const featureOptions=[['employees','員工管理'],['sites','案場管理'],['schedules','勤務排班'],['attendance','打卡紀錄'],['supervisorInspections','督導巡查'],['leaves','請假審核'],['complaints','反霸凌申訴'],['payrollProfiles','薪資設定'],['advances','員工借支'],['payroll','薪資明細'],['terminations','離職證明'],['tenderQuotations','競標合約報價'],['vendors','合作廠商'],['inventoryItems','庫存物品'],['inventoryTransactions','入庫／領用紀錄'],['announcements','公告管理']];
  const featurePresentation={employees:['人','人事管理'],sites:['場','營運管理'],schedules:['班','營運管理'],attendance:['卡','營運管理'],supervisorInspections:['巡','營運管理'],leaves:['假','人事管理'],complaints:['申','人事管理'],payrollProfiles:['薪','薪資行政'],advances:['借','薪資行政'],payroll:['單','薪資行政'],terminations:['離','薪資行政'],tenderQuotations:['標','業務競標'],vendors:['商','採購庫存'],inventoryItems:['庫','採購庫存'],inventoryTransactions:['領','採購庫存'],announcements:['告','公告管理']};

  const fields = {
    employees: [
      ['employee_no','員工編號','text',true],['full_name','姓名','text',true],['phone','電話','tel'],['initial_password','初始登入密碼','password'],
      ['emergency_contact_name','緊急聯絡人','text'],['emergency_contact_phone','緊急聯絡電話','tel'],['hire_date','入職日期','date'],['employment_type','身分類別','select',true,[['full_time','正職人員'],['mobile','機動人員']]],
      ['assigned_sites','可排班案場','site-picker'],
      ['job_title','職稱','select',true,[['保全員','保全員'],['機動保全員','機動保全員'],['案場主任','案場主任'],['總幹事','總幹事'],['社區秘書','社區秘書'],['勤務督導','勤務督導'],['行政專員','行政專員'],['人事專員','人事專員'],['會計專員','會計專員'],['部門主管','部門主管'],['總經理','總經理']]],
      ['standard_daily_hours','標準每日工時','number',true],
      ['cash_shift_default_amount','現金班預設日薪','number'],
      ['annual_leave_entitlement_hours','本期特休總時數（自動）','readonly'],['annual_leave_used_hours','本期已休時數（自動）','readonly'],['annual_leave_hours','本期剩餘時數（自動）','readonly'],
      ['annual_leave_period_start','特休期間開始（自動）','readonly'],['annual_leave_period_end','特休期間結束（自動）','readonly'],
      ['role','系統權限','select',true,[['guard','一般員工'],['site_manager','案場主管'],['hr','人事／行政'],['admin','系統管理員']]],
      ['feature_permissions','可使用的後台功能','feature-picker'],
      ['status','狀態','select',true,[['active','在職'],['inactive','離職／停用']]]
    ],
    sites: [
      ['code','案場代碼','text',true],['name','案場名稱','text',true],['address','地址','text',true],
      ['chairman_name','主委姓名','text'],['chairman_phone','主委電話','tel'],['household_count','社區戶數','number'],['committee_term_no','管理委員會屆數','number'],
      ['owners_meeting_date','區分所有權人會議日期','date'],['regular_meeting_schedule','固定例會時間','text'],
      ['contract_start_date','合約開始日期','date'],['contract_end_date','合約到期日期','date'],['renewal_reminder_days','到期前提醒天數','number',true],
      ['renewal_status','續約進度','select',true,[['not_started','尚未洽談'],['contacting','聯絡中'],['negotiating','議約中'],['renewed','已續約'],['not_renewing','不續約']]],['contract_note','合約／續約備註','textarea'],
      ['latitude','GPS 緯度','number'],['longitude','GPS 經度','number'],['punch_radius_m','打卡半徑（公尺）','number'],['status','狀態','select',true,[['active','啟用'],['inactive','停用']]]
    ],
    schedules: [
      ['employee_id','員工','relation:employees',true],['site_id','案場','relation:sites',true],['work_date','勤務日期','date',true],
      ['shift_type','班別','select',true,[['day','日班'],['night','夜班'],['cash','現金班（當日領現）'],['custom','自訂']]],['start_time','開始時間','time',true],['end_time','結束時間','time',true],['cash_amount','現金班金額','number'],['cash_payment_status','領現狀態','select',false,[['none','非現金班'],['pending','待領現'],['paid','已領現']]]
    ],
    attendance: [
      ['employee_id','員工','relation:employees',true],['site_id','案場','relation:sites',true],['work_date','日期','date',true],
      ['clock_in','上班時間','datetime-local'],['clock_out','下班時間','datetime-local'],['status','狀態','select',true,[['normal','正常'],['late','遲到'],['missing','缺卡']]]
    ],
    supervisor_inspections: [
      ['inspection_date','巡查日期','date',true],['inspection_time','巡查時間','time',true],['site_id','巡查案場','relation:sites',true],['employee_id','督導人員','relation:employees',true],
      ['inspection_type','巡查類型','select',true,[['routine','例行巡查'],['night','夜間巡查'],['payroll_delivery','薪資發放']]],['overall_result','整體結果','select',true,[['pass','合格'],['improvement_required','限期改善'],['critical','重大缺失']]],
      ['staff_discipline','人員服儀與勤務紀律','select',true,[['good','良好'],['needs_improvement','待改善'],['not_applicable','不適用']]],['post_records','哨所簿冊與交接紀錄','select',true,[['good','良好'],['needs_improvement','待改善'],['not_applicable','不適用']]],
      ['equipment_status','裝備器材與門禁設備','select',true,[['good','良好'],['needs_improvement','待改善'],['not_applicable','不適用']]],['environment_safety','環境與消防安全','select',true,[['good','良好'],['needs_improvement','待改善'],['not_applicable','不適用']]],
      ['findings','巡查紀要／缺失內容','textarea'],['corrective_action','改善要求','textarea'],['due_date','改善期限','date'],['follow_up_status','改善追蹤','select',true,[['none','無須改善'],['pending','待改善'],['in_progress','改善中'],['verified','已複查完成']]],
      ['resolved_at','完成改善日期','date'],['site_contact','案場陪同／簽認人','text'],['note','備註','textarea']
    ],
    leave_requests: [
      ['employee_id','員工','relation:employees',true],['leave_type','假別','select',true,[['annual','特休'],['personal','事假'],['sick','病假'],['official','公假'],['marriage','婚假'],['bereavement','喪假'],['maternity','產假'],['paternity','陪產檢及陪產假'],['menstrual','生理假'],['occupational','公傷病假'],['compensatory','補休'],['unpaid','無薪假'],['typhoon_unpaid','天然災害未出勤（不支薪）'],['other','其他']]],
      ['start_date','開始日期','date',true],['end_date','結束日期','date',true],['leave_hours','請假時數','number',true],['reason','原因','textarea',true],['proof_path','證明文件路徑','text'],
      ['status','審核狀態','select',true,[['pending','待審核'],['approved','已核准'],['rejected','已退回']]],['review_note','審核備註','textarea']
    ],
    bullying_complaints: [
      ['employee_id','申訴員工','relation:employees',true],['incident_date','事件日期','date',true],['incident_location','事件地點','text'],['accused_name','被申訴人','text'],
      ['description','事件說明','textarea',true],['requested_action','希望處理方式','textarea'],['evidence_path','證明文件路徑','text'],
      ['status','處理狀態','select',true,[['submitted','已送出'],['processing','處理中'],['resolved','已處理'],['closed','已結案']]],['handler_note','處理紀錄（保密）','textarea']
    ],
    employee_payroll_profiles: [
      ['employee_id','員工','relation:employees',true],['basic_salary','月薪總額','number',true],['personal_leave_day_rate','事假一天扣款（自動）','readonly'],['sick_leave_day_rate','病假一天扣款（自動）','readonly'],
      ['labor_insurance','勞保自付額','number',true],['health_insurance','健保自付額','number',true],['group_insurance','團保自付額','number',true],['effective_date','生效日期','date',true],['note','備註','textarea']
    ],
    salary_advances: [
      ['employee_id','員工','relation:employees',true],['advance_date','借支日期','date',true],['amount','借支金額','number',true],['repayment_month','預計扣回月份','month'],
      ['status','狀態','select',true,[['pending','待審核'],['approved','已核准'],['deducted','已扣回'],['rejected','已退回'],['cancelled','已取消']]],['note','說明','textarea']
    ],
    payroll_records: [
      ['employee_id','員工','relation:employees',true],['payroll_month','薪資月份','month',true],['basic_salary','基本薪資','number',true],['overtime_pay','加班費','number',true],['allowances','津貼／加給','number',true],
      ['personal_leave_hours','事假時數（全額扣薪）','number',true],['sick_leave_hours','病假時數（半薪扣款）','number',true],['unpaid_leave_hours','無薪／天然災害不支薪時數','number',true],['labor_insurance','勞保','number',true],['health_insurance','健保','number',true],['group_insurance','團保','number',true],
      ['court_deduction','法院扣薪','number',true],['advance_deduction','借支扣回','number',true],['other_deduction','其他扣款','number',true],['other_deduction_note','其他扣款說明','textarea'],
      ['status','薪資單狀態','select',true,[['draft','草稿'],['confirmed','已確認'],['paid','已發薪']]],['paid_date','發薪日期','date'],['note','備註','textarea']
    ],
    termination_certificates: [
      ['employee_id','員工','relation:employees',true],['separation_date','離職日期','date',true],
      ['separation_reason','離職原因','select',true,[
        ['自願離職（勞工自行終止契約）','自願離職（勞工自行終止契約）'],
        ['定期契約期滿','定期契約期滿'],['勞工自請退休','勞工自請退休'],['雇主依法強制退休','雇主依法強制退休'],
        ['歇業或轉讓（勞基法第11條第1款）','歇業或轉讓（勞基法第11條第1款）'],['虧損或業務緊縮（勞基法第11條第2款）','虧損或業務緊縮（勞基法第11條第2款）'],
        ['不可抗力暫停工作逾一個月（勞基法第11條第3款）','不可抗力暫停工作逾一個月（勞基法第11條第3款）'],['業務性質變更且無適當工作安置（勞基法第11條第4款）','業務性質變更且無適當工作安置（勞基法第11條第4款）'],
        ['對所擔任工作確不能勝任（勞基法第11條第5款）','對所擔任工作確不能勝任（勞基法第11條第5款）'],['重大違規解僱（勞基法第12條，須符合個案法定要件）','重大違規解僱（勞基法第12條，須符合個案法定要件）'],
        ['勞工依法不經預告終止（勞基法第14條）','勞工依法不經預告終止（勞基法第14條）'],
        ['逾70歲不得擔任保全人員（保全業法第10條之1，依法定例外判斷）','逾70歲不得擔任保全人員（保全業法第10條之1，依法定例外判斷）'],
        ['保全人員資格不符（保全業法第10條之1）','保全人員資格不符（保全業法第10條之1）'],['其他依法終止','其他依法終止']
      ]],
      ['job_description','工作職務內容','select',true,[
        ['駐衛保全勤務（門禁、巡邏、防竊、防災）','駐衛保全勤務（門禁、巡邏、防竊、防災）'],['機動保全勤務','機動保全勤務'],['系統保全勤務','系統保全勤務'],['運送保全勤務','運送保全勤務'],['人身保全勤務','人身保全勤務'],
        ['案場主任／現場管理','案場主任／現場管理'],['勤務督導／勤務管理','勤務督導／勤務管理'],['行政／人事作業','行政／人事作業'],['會計／薪資作業','會計／薪資作業'],['部門主管／營運管理','部門主管／營運管理']
      ]],
      ['issue_date','開立日期','date',true],['certificate_no','證明書編號','text'],['note','補充說明','textarea']
    ],
    vendors: [
      ['vendor_code','廠商編號','text',true],['name','廠商名稱','text',true],['category','廠商類別','select',true,[['security_equipment','保全設備'],['uniform','制服／配件'],['cleaning','清潔用品'],['repair','修繕工程'],['fire_safety','消防設備'],['electromechanical','機電維護'],['staffing','人力支援'],['office','辦公用品'],['other','其他']]],
      ['tax_id','統一編號','text'],['contact_name','主要聯絡人','text'],['contact_phone','聯絡電話','tel'],['contact_email','電子郵件','email'],['invoice_email','發票寄送信箱','email'],['address','公司地址','text'],
      ['payment_terms','付款條件','select',true,[['cash_payment','現金'],['cod','貨到付款'],['net_30','月結30天'],['net_45','月結45天'],['net_60','月結60天'],['other','其他']]],['bank_name','往來銀行','text'],['bank_account_name','戶名','text'],['bank_account_last5','帳號末五碼','text'],
      ['contract_start_date','合作開始日','date'],['contract_end_date','合約到期日','date'],['status','合作狀態','select',true,[['active','合作中'],['inactive','暫停／終止']]],['service_scope','服務／供應內容','textarea'],['note','備註','textarea']
    ],
    inventory_items: [
      ['item_code','物品編號','text',true],['item_name','物品名稱','text',true],['category','分類','select',true,[['uniform','服裝配件'],['equipment','保全設備'],['traffic','交通／拒馬設備'],['office','辦公用品'],['cleaning','清潔用品'],['other','其他']]],
      ['specification','規格／型號','text'],['size','尺寸','text'],['unit','單位','text',true],['minimum_stock','安全庫存量','number',true],['storage_location','存放位置','text'],['status','狀態','select',true,[['active','啟用'],['inactive','停用']]],['note','備註','textarea']
    ],
    inventory_transactions: [
      ['item_id','物品','relation:inventory_items',true],['transaction_type','異動類型','select',true,[['purchase','採購入庫'],['issue','領用出庫'],['return','退回入庫'],['adjust_in','盤點增加'],['adjust_out','盤點減少']]],['quantity','數量','number',true],['transaction_date','日期','date',true],['vendor_id','採購廠商','relation:vendors'],
      ['employee_id','領用員工（與案場擇一）','relation:employees'],['site_id','領用案場（與員工擇一）','relation:sites'],['receiver_name','實際領取人','text'],['purpose','用途','text'],['document_no','單據編號','text'],['note','備註','textarea']
    ],
    announcements:[['publisher','發布單位','text',true],['content','公告內容','textarea',true],['published_at','發布時間','datetime-local',true],['is_active','狀態','select',true,[['true','上架'],['false','下架']]]]
  };

  const columns = {
    employees: [['employee_no','編號'],['full_name','姓名'],['job_title','職稱'],['hire_date','到職日'],['cash_shift_default_amount','現金班日薪'],['annual_leave_entitlement_hours','本期特休'],['annual_leave_used_hours','已休'],['annual_leave_hours','剩餘'],['annual_leave_period_end','本期截止'],['status','狀態']],
    sites: [['code','代碼'],['name','案場'],['chairman_name','主委'],['household_count','戶數'],['committee_term_no','屆數'],['contract_end_date','合約到期'],['renewal_status','續約進度'],['status','狀態']],
    schedules: [['work_date','日期'],['employee_id','員工'],['site_id','案場'],['shift_type','班別'],['start_time','時間']],
    attendance: [['work_date','日期'],['employee_id','員工'],['site_id','案場'],['clock_in','上班'],['clock_out','下班'],['status','狀態']],
    supervisor_inspections: [['inspection_date','日期'],['inspection_time','時間'],['site_id','案場'],['employee_id','督導'],['inspection_type','類型'],['overall_result','結果'],['follow_up_status','改善追蹤'],['due_date','期限']],
    leave_requests: [['employee_id','員工'],['leave_type','假別'],['start_date','開始'],['end_date','結束'],['leave_hours','時數'],['proof_path','證明文件'],['status','狀態']],
    bullying_complaints: [['created_at','提出時間'],['employee_id','申訴員工'],['incident_date','事件日期'],['accused_name','被申訴人'],['evidence_path','證明文件'],['status','狀態']],
    employee_payroll_profiles: [['employee_id','員工'],['basic_salary','月薪總額'],['personal_leave_day_rate','事假／日'],['sick_leave_day_rate','病假／日'],['labor_insurance','勞保'],['health_insurance','健保'],['group_insurance','團保'],['effective_date','生效日期']],
    salary_advances: [['advance_date','日期'],['employee_id','員工'],['amount','金額'],['repayment_month','扣回月份'],['status','狀態']],
    payroll_records: [['payroll_month','月份'],['employee_id','員工'],['gross_pay','應發'],['total_deduction','總扣款'],['net_pay','實發'],['status','狀態']],
    termination_certificates: [['certificate_no','證明編號'],['employee_id','員工'],['separation_date','離職日期'],['issue_date','開立日期']],
    vendors: [['vendor_code','編號'],['name','廠商名稱'],['category','類別'],['tax_id','統編'],['contact_name','聯絡人'],['contact_phone','電話'],['payment_terms','付款條件'],['contract_end_date','合約到期'],['status','狀態']],
    inventory_items: [['item_code','編號'],['item_name','物品'],['category','分類'],['specification','規格'],['size','尺寸'],['current_stock','現有庫存'],['unit','單位'],['minimum_stock','安全庫存']],
    inventory_transactions: [['transaction_date','日期'],['transaction_type','類型'],['item_id','物品'],['quantity','數量'],['vendor_id','廠商'],['employee_id','員工'],['site_id','案場'],['receiver_name','領取人']],
    audit_logs: [['created_at','操作時間'],['actor_name','操作者'],['action','動作'],['table_name','資料表'],['record_id','資料編號']],
    announcements:[['published_at','發布時間'],['publisher','發布單位'],['content','內容'],['is_active','狀態']]
  };

  let state = { view: 'dashboard', user: null, editing: null, relations: {employees:[],sites:[],inventory_items:[],vendors:[]}, scheduleMonth: new Date().toISOString().slice(0,7), scheduleEmployee: '', attendanceMonth: new Date().toISOString().slice(0,7), attendanceSite: '' };

  function seedDemo() {
    const today = new Date().toISOString().slice(0,10);
    return {
      employees:[
        {id:'e1',employee_no:'A001',full_name:'王大明',phone:'0912-345-678',role:'site_manager',status:'active'},
        {id:'e2',employee_no:'A002',full_name:'陳志宏',phone:'0922-555-168',role:'guard',status:'active'},
        {id:'e3',employee_no:'A003',full_name:'林怡君',phone:'0933-812-520',role:'hr',status:'active'}
      ],
      sites:[{id:'s1',code:'TP001',name:'晴川社區',address:'台北市中山區民權東路',contact_name:'李主委',contact_phone:'02-2500-1688',status:'active'}],
      schedules:[{id:'sc1',employee_id:'e2',site_id:'s1',work_date:today,shift_type:'day',start_time:'07:00',end_time:'19:00'}],
      attendance:[{id:'a1',employee_id:'e2',site_id:'s1',work_date:today,clock_in:`${today}T06:55`,clock_out:'',status:'normal'}],
      leave_requests:[{id:'l1',employee_id:'e2',leave_type:'annual',start_date:today,end_date:today,reason:'家庭事務',status:'pending'}],
      supervisor_inspections:[{id:'si1',inspection_date:today,inspection_time:'10:30',site_id:'s1',employee_id:'e1',inspection_type:'routine',overall_result:'improvement_required',staff_discipline:'good',post_records:'needs_improvement',equipment_status:'good',environment_safety:'good',findings:'值勤簿冊部分欄位未完整填寫。',corrective_action:'請案場主管於期限前完成補正並拍照回報。',due_date:today,follow_up_status:'pending',site_contact:'陳志宏'}],
      vendors:[{id:'v1',vendor_code:'V001',name:'安心保全設備行',category:'security_equipment',tax_id:'12345678',contact_name:'林先生',contact_phone:'02-2345-6789',payment_terms:'net_30',status:'active'}]
    };
  }

  function demoData() {
    let data;
    try { data = JSON.parse(localStorage.getItem(demoKey)); } catch (_) {}
    if (!data) { data = seedDemo(); localStorage.setItem(demoKey, JSON.stringify(data)); }
    return data;
  }

  const db = {
    async list(table) {
      if (!cloudEnabled) return demoData()[table] || [];
      const {data,error} = await client.from(table).select('*').order('created_at',{ascending:false});
      if (error) throw error; return data;
    },
    async save(table, record, id) {
      if (!cloudEnabled) {
        const data=demoData(); const clean={...record};
        if (id) data[table]=data[table].map(row=>row.id===id?{...row,...clean}:row);
        else data[table].unshift({id:crypto.randomUUID(),...clean});
        localStorage.setItem(demoKey,JSON.stringify(data)); return id?data[table].find(row=>row.id===id):data[table][0];
      }
      const query=(id?client.from(table).update(record).eq('id',id):client.from(table).insert(record)).select().single();
      const {data,error}=await query; if(error) throw error; return data;
    },
    async remove(table,id) {
      if (!cloudEnabled) { const data=demoData(); data[table]=data[table].filter(row=>row.id!==id); localStorage.setItem(demoKey,JSON.stringify(data)); return; }
      const {error}=await client.from(table).delete().eq('id',id); if(error) throw error;
    }
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const labels = {guard:'保全人員',site_manager:'案場主管',hr:'人事',admin:'管理員',active:'啟用／在職',inactive:'停用',full_time:'正職人員',mobile:'機動人員',day:'日班',night:'夜班',custom:'自訂',normal:'正常',late:'遲到',missing:'缺卡',annual:'特休',personal:'事假',sick:'病假',official:'公假',marriage:'婚假',bereavement:'喪假',maternity:'產假',paternity:'陪產檢及陪產假',menstrual:'生理假',occupational:'公傷病假',compensatory:'補休',unpaid:'無薪假',typhoon_unpaid:'天然災害未出勤（不支薪）',other:'其他',uniform:'服裝配件',equipment:'保全設備',traffic:'交通／拒馬設備',office:'辦公用品',cleaning:'清潔用品',purchase:'採購入庫',issue:'領用出庫',return:'退回入庫',adjust_in:'盤點增加',adjust_out:'盤點減少',pending:'待審核',approved:'已核准',rejected:'已退回',cancelled:'已取消',deducted:'已扣回',draft:'草稿',confirmed:'已確認',paid:'已發薪',submitted:'已送出',processing:'處理中',resolved:'已處理',closed:'已結案',not_started:'尚未洽談',contacting:'聯絡中',negotiating:'議約中',renewed:'已續約',not_renewing:'不續約',true:'是',false:'否'};
  Object.assign(labels,{routine:'例行巡查',night:'夜間巡查',cash:'現金班（當日領現）',cash_payment:'現金',payroll_delivery:'薪資發放',pass:'合格',improvement_required:'限期改善',critical:'重大缺失',good:'良好',needs_improvement:'待改善',not_applicable:'不適用',none:'無須改善',in_progress:'改善中',verified:'已複查完成',security_equipment:'保全設備',repair:'修繕工程',fire_safety:'消防設備',electromechanical:'機電維護',staffing:'人力支援',net_30:'月結30天',net_45:'月結45天',net_60:'月結60天',cod:'貨到付款'});
  const format = (key,value) => {
    if ((key==='employee_id'||key==='site_id') && value) {
      const list=key==='employee_id'?state.relations.employees:state.relations.sites;
      return list.find(row=>row.id===value)?.[key==='employee_id'?'full_name':'name'] || value;
    }
    if(key==='item_id'&&value)return state.relations.inventory_items.find(row=>row.id===value)?.item_name||value;
    if(key==='vendor_id'&&value)return state.relations.vendors.find(row=>row.id===value)?.name||value;
    if(key==='action')return({INSERT:'新增',UPDATE:'修改',DELETE:'刪除'})[value]||value;
    if (key==='start_time' && value) return value;
    if ((key==='clock_in'||key==='clock_out') && value) return value.replace('T',' ');
    return labels[value] || value || '—';
  };
  const badge = value => `<span class="badge ${['pending','late'].includes(value)?'warning':''} ${['inactive','missing','rejected'].includes(value)?'danger':''}">${esc(format('',value))}</span>`;
  const isBadge = key => ['status','role','shift_type','leave_type','renewal_status','transaction_type','category','is_active','is_manager','inspection_type','overall_result','follow_up_status'].includes(key);
  const cellHtml = (key,value) => key==='proof_path'||key==='evidence_path' ? (value?`<button class="mini-button" data-private-file="${esc(value)}">開啟附件</button>`:'—') : isBadge(key)?badge(value):esc(format(key,value));

  async function loadRelations() {
    const canInventory=state.user?.role==='admin'||state.user?.permissions?.some(x=>['vendors','inventoryItems','inventoryTransactions'].includes(x));
    [state.relations.employees,state.relations.sites,state.relations.inventory_items,state.relations.vendors]=await Promise.all([db.list('employees'),db.list('sites'),canInventory?db.list('inventory_items'):Promise.resolve([]),canInventory?db.list('vendors'):Promise.resolve([])]);
  }

  async function renderDashboard() {
    if(state.user?.role!=='admin'){const allowed=featureOptions.filter(([key])=>state.user?.permissions?.includes(key));$('#content').innerHTML=`<section class="staff-welcome"><div><p class="eyebrow">WORKSPACE</p><h3>${esc(state.user?.name)}，歡迎回來</h3><p>從下方選擇今天要處理的工作。</p></div><div class="access-count"><strong>${allowed.length}</strong><span>項可用功能</span></div></section><section class="permission-section"><div class="permission-title"><div><h3>我的工作區</h3><p>依管理員授權顯示</p></div></div><div class="permission-grid">${allowed.map(([key,text])=>{const meta=featurePresentation[key]||['功','工作功能'];return`<button class="permission-card" data-go="${key}"><span class="permission-icon">${meta[0]}</span><span class="permission-copy"><small>${meta[1]}</small><strong>${text}</strong></span><span class="permission-arrow">→</span></button>`}).join('')||'<div class="empty permission-empty">目前尚未授權任何後台功能，請聯絡系統管理員。</div>'}</div></section>`;$$('[data-go]').forEach(button=>button.onclick=()=>switchView(button.dataset.go));return}
    const [employees,sites,schedules,attendance,leaves]=await Promise.all(['employees','sites','schedules','attendance','leave_requests'].map(db.list));
    state.relations={employees,sites};
    const today=new Date().toISOString().slice(0,10);
    const todaySchedules=schedules.filter(x=>x.work_date===today);
    const pending=leaves.filter(x=>x.status==='pending');
    const todayDate=new Date(`${today}T00:00:00`),contractAlerts=sites.filter(site=>{if(!site.contract_end_date||site.renewal_status==='renewed')return false;const days=Math.ceil((new Date(`${site.contract_end_date}T00:00:00`)-todayDate)/86400000);return days<=Number(site.renewal_reminder_days??90);}).sort((a,b)=>String(a.contract_end_date).localeCompare(String(b.contract_end_date)));
    $('#content').innerHTML=`
      <div class="stats">
        <article class="stat-card"><small>在職員工</small><strong>${employees.filter(x=>x.status==='active').length}</strong><em>人員帳冊</em></article>
        <article class="stat-card"><small>啟用案場</small><strong>${sites.filter(x=>x.status==='active').length}</strong><em>服務據點</em></article>
        <article class="stat-card"><small>今日勤務</small><strong>${todaySchedules.length}</strong><em>${today}</em></article>
        <article class="stat-card"><small>待審請假</small><strong>${pending.length}</strong><em>需要處理</em></article>
      </div>
      <div class="grid-2">
        <article class="panel"><div class="panel-head"><h3>今日勤務</h3><button class="mini-button" data-go="schedules">查看全部</button></div>${quickList(todaySchedules,'schedule')}</article>
        <article class="panel"><div class="panel-head"><h3>待辦事項</h3><button class="mini-button" data-go="leaves">前往審核</button></div>${quickList(pending,'leave')}</article>
      </div>
      <article class="panel contract-alerts"><div class="panel-head"><div><h3>合約續約提醒</h3><span class="muted">依各案場設定的提醒天數顯示</span></div><button class="mini-button" data-go="sites">案場管理</button></div><div class="quick-list">${contractAlerts.length?contractAlerts.map(site=>{const days=Math.ceil((new Date(`${site.contract_end_date}T00:00:00`)-todayDate)/86400000),text=days<0?`已逾期 ${Math.abs(days)} 天`:days===0?'今天到期':`剩餘 ${days} 天`;return`<div class="quick-item contract-alert ${days<0?'overdue':''}"><div><strong>${esc(site.name)}</strong><small>合約到期：${esc(site.contract_end_date)} · ${esc(labels[site.renewal_status]||site.renewal_status)}</small></div><span class="badge ${days<=30?'danger':'warning'}">${text}</span></div>`}).join(''):'<div class="empty">目前沒有即將到期的合約</div>'}</div></article>`;
    $$('[data-go]').forEach(button=>button.onclick=()=>switchView(button.dataset.go));
  }

  function quickList(rows,type) {
    if(!rows.length) return '<div class="empty">目前沒有資料</div>';
    return `<div class="quick-list">${rows.slice(0,6).map(row=>type==='schedule'
      ?`<div class="quick-item"><div><strong>${esc(format('employee_id',row.employee_id))}</strong><small>${esc(format('site_id',row.site_id))} · ${esc(format('shift_type',row.shift_type))}</small></div><span class="badge">${esc(row.start_time)}－${esc(row.end_time)}</span></div>`
      :`<div class="quick-item"><div><strong>${esc(format('employee_id',row.employee_id))}</strong><small>${esc(format('leave_type',row.leave_type))} · ${esc(row.start_date)} 至 ${esc(row.end_date)}</small></div>${badge(row.status)}</div>`).join('')}</div>`;
  }

  function downloadAuditArchive(rows){if(!rows.length){showNotice('目前沒有可封存的操作紀錄。','error');return false}const csv=value=>`"${String(value??'').replace(/"/g,'""')}"`,lines=[['操作時間','操作者','動作','資料表','資料編號','完整異動內容'],...rows.map(row=>[row.created_at,row.actor_name||row.actor_id,format('action',row.action),row.table_name,row.record_id,JSON.stringify(row.details||{})])],blob=new Blob(['\ufeff'+lines.map(line=>line.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a'),stamp=new Date().toISOString().slice(0,10);link.href=url;link.download=`紘嘉ERP_操作紀錄_${stamp}_${rows.length}筆.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);return true;}

  async function archiveAndClearAuditLogs(rows){if(!rows.length)return showNotice('目前沒有可封存的操作紀錄。','error');if(!confirm(`將下載 ${rows.length} 筆完整操作紀錄，並從雲端永久刪除同一批資料。請確認下載檔案會存放在瀏覽器的下載資料夾。`))return;if(!downloadAuditArchive(rows))return;if(!cloudEnabled){showNotice('操作紀錄已下載；示範模式沒有雲端資料需要清除。','success');return}const cutoff=rows.reduce((latest,row)=>String(row.created_at)>latest?String(row.created_at):latest,'');const{error}=await client.from('audit_logs').delete().lte('created_at',cutoff);if(error){showNotice(`檔案已下載，但雲端清除失敗：${error.message}`,'error');return}showNotice(`已下載並清除 ${rows.length} 筆雲端操作紀錄。`,'success');await renderCurrent();}

  function printDocument(title,body){const win=window.open('','_blank','noopener,noreferrer');if(!win)return showNotice('瀏覽器阻擋列印視窗，請允許彈出式視窗。','error');win.document.write(`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:"Microsoft JhengHei",sans-serif;color:#162b3d;max-width:820px;margin:40px auto;padding:0 28px}header{text-align:center;border-bottom:2px solid #16324f;padding-bottom:18px;margin-bottom:24px}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bdc9d3;padding:10px;text-align:left}.amount{text-align:right}.sign{margin-top:70px;display:flex;justify-content:space-between}@media print{button{display:none}body{margin:0}}</style></head><body><header><h1>紘嘉物業保全股份有限公司</h1><strong>${esc(title)}</strong></header>${body}<div class="sign"><span>公司用印：________________</span><span>員工簽收：________________</span></div><p><button onclick="window.print()">列印／另存 PDF</button></p></body></html>`);win.document.close();}
  function printPayroll(row){const employee=state.relations.employees.find(x=>x.id===row.employee_id),money=v=>Number(v||0).toLocaleString('zh-TW');printDocument(`${row.payroll_month} 薪資單`,`<p>員工：${esc(employee?.employee_no||'')}　${esc(employee?.full_name||'')}</p><table><tr><th>應發項目</th><th class="amount">金額</th><th>扣款項目</th><th class="amount">金額</th></tr><tr><td>基本薪資</td><td class="amount">${money(row.basic_salary)}</td><td>事假扣款</td><td class="amount">${money(row.personal_leave_deduction)}</td></tr><tr><td>加班費</td><td class="amount">${money(row.overtime_pay)}</td><td>病假扣款</td><td class="amount">${money(row.sick_leave_deduction)}</td></tr><tr><td>津貼／加給</td><td class="amount">${money(row.allowances)}</td><td>勞健團保</td><td class="amount">${money(Number(row.labor_insurance||0)+Number(row.health_insurance||0)+Number(row.group_insurance||0))}</td></tr><tr><td><strong>應發合計</strong></td><td class="amount"><strong>${money(row.gross_pay)}</strong></td><td>法院／借支／其他</td><td class="amount">${money(Number(row.court_deduction||0)+Number(row.advance_deduction||0)+Number(row.other_deduction||0))}</td></tr><tr><th colspan="3">實發金額</th><th class="amount">NT$ ${money(row.net_pay)}</th></tr></table><p>備註：${esc(row.note||'無')}</p>`);}
  function printTermination(row){const employee=state.relations.employees.find(x=>x.id===row.employee_id);printDocument('離職證明書',`<p>證明書編號：${esc(row.certificate_no||'')}</p><p>茲證明 <strong>${esc(employee?.full_name||'')}</strong>（員工編號：${esc(employee?.employee_no||'')}）曾任職於本公司。</p><table><tr><th>職稱</th><td>${esc(employee?.job_title||'')}</td></tr><tr><th>到職日期</th><td>${esc(employee?.hire_date||'')}</td></tr><tr><th>離職日期</th><td>${esc(row.separation_date)}</td></tr><tr><th>工作內容</th><td>${esc(row.job_description||'')}</td></tr><tr><th>離職原因</th><td>${esc(row.separation_reason)}</td></tr><tr><th>開立日期</th><td>${esc(row.issue_date)}</td></tr></table><p>特此證明。</p>`);}
  function printAdvance(row){const employee=state.relations.employees.find(x=>x.id===row.employee_id),money=Number(row.amount||0).toLocaleString('zh-TW');printDocument('員工薪資借支申請暨同意書',`<p>申請人：${esc(employee?.employee_no||'')}　<strong>${esc(employee?.full_name||'')}</strong></p><table><tr><th>借支日期</th><td>${esc(row.advance_date)}</td></tr><tr><th>借支金額</th><td>新臺幣 ${money} 元整</td></tr><tr><th>預計薪資扣回月份</th><td>${esc(row.repayment_month||'另行約定')}</td></tr><tr><th>借支說明</th><td>${esc(row.note||'')}</td></tr></table><p>本人確認上述借支內容無誤，並同意公司於約定月份之薪資中扣回核准借支金額；實際核准及扣回方式以公司確認為準。</p>`);}
  function printInventoryTransaction(row){const item=state.relations.inventory_items.find(x=>x.id===row.item_id),employee=state.relations.employees.find(x=>x.id===row.employee_id),site=state.relations.sites.find(x=>x.id===row.site_id),recipient=employee?`${employee.employee_no} ${employee.full_name}`:site?.name||row.receiver_name||'未指定';printDocument('物品領取／庫存異動單',`<p>單據編號：${esc(row.document_no||row.id.slice(0,8).toUpperCase())}</p><table><tr><th>異動日期</th><td>${esc(row.transaction_date)}</td></tr><tr><th>異動類型</th><td>${esc(labels[row.transaction_type]||row.transaction_type)}</td></tr><tr><th>物品</th><td>${esc(item?.item_code||'')}　<strong>${esc(item?.item_name||'')}</strong></td></tr><tr><th>規格／尺寸</th><td>${esc(item?.specification||'—')}／${esc(item?.size||'—')}</td></tr><tr><th>數量</th><td>${esc(row.quantity)} ${esc(item?.unit||'')}</td></tr><tr><th>領用員工／案場</th><td>${esc(recipient)}</td></tr><tr><th>實際領取人</th><td>${esc(row.receiver_name||employee?.full_name||'')}</td></tr><tr><th>用途</th><td>${esc(row.purpose||'')}</td></tr><tr><th>備註</th><td>${esc(row.note||'')}</td></tr></table><p>領取人確認上述物品、規格及數量無誤，並依公司規定妥善保管及使用。</p>`);}
  async function printInventoryDocument(row){let rows=[row];if(cloudEnabled&&row.document_no){const{data,error}=await client.from('inventory_transactions').select('*').eq('document_no',row.document_no).order('created_at');if(error)return showNotice(`領取單載入失敗：${error.message}`,'error');rows=data||rows}const employee=state.relations.employees.find(x=>x.id===row.employee_id),site=state.relations.sites.find(x=>x.id===row.site_id),recipient=employee?`${employee.employee_no} ${employee.full_name}`:site?.name||row.receiver_name||'未指定';printDocument('物品領取單',`<p>單據編號：${esc(row.document_no||row.id.slice(0,8).toUpperCase())}　　領取日期：${esc(row.transaction_date)}</p><p>領用員工／案場：<strong>${esc(recipient)}</strong>　　實際領取人：${esc(row.receiver_name||employee?.full_name||'')}</p><table><thead><tr><th>物品編號</th><th>物品名稱</th><th>規格</th><th>尺寸</th><th>數量</th><th>單位</th></tr></thead><tbody>${rows.map(x=>{const item=state.relations.inventory_items.find(i=>i.id===x.item_id);return`<tr><td>${esc(item?.item_code||'')}</td><td>${esc(item?.item_name||'')}</td><td>${esc(item?.specification||'')}</td><td>${esc(item?.size||'')}</td><td>${esc(x.quantity)}</td><td>${esc(item?.unit||'')}</td></tr>`}).join('')}</tbody></table><p>用途：${esc(row.purpose||'')}　　備註：${esc(row.note||'')}</p><p>領取人確認上述物品、規格及數量無誤，並依公司規定妥善保管及使用。</p>`);}

  function printDocument(title,body){const old=$('#printFrame');if(old)old.remove();const frame=document.createElement('iframe');frame.id='printFrame';frame.title='列印文件';frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none';document.body.appendChild(frame);frame.onload=()=>setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print()},150);frame.srcdoc=`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:16mm}body{font-family:"Microsoft JhengHei",sans-serif;color:#162b3d;margin:0}header{text-align:center;border-bottom:2px solid #16324f;padding-bottom:18px;margin-bottom:24px}h1{margin:0 0 8px;font-size:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bdc9d3;padding:10px;text-align:left}.amount{text-align:right}.sign{margin-top:70px;display:flex;justify-content:space-between}</style></head><body><header><h1>紘嘉物業保全股份有限公司</h1><strong>${esc(title)}</strong></header>${body}<div class="sign"><span>公司用印：________________</span><span>員工簽收：________________</span></div></body></html>`;}

  function openBatchIssueDialog(){let dialog=$('#batchIssueDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='batchIssueDialog';document.body.appendChild(dialog)}const employeeOptions=state.relations.employees.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${esc(x.employee_no)}－${esc(x.full_name)}</option>`).join(''),siteOptions=state.relations.sites.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');dialog.innerHTML=`<form id="batchIssueForm"><div class="dialog-head"><div><p class="eyebrow">庫存管理</p><h3>新增多品項領取單</h3></div><button type="button" class="icon-button batch-close">×</button></div><div class="form-grid"><label>領用日期<input name="transaction_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>單據編號<input name="document_no" value="ISS-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}" required></label><label>領用員工（與案場擇一）<select name="employee_id"><option value="">不指定員工</option>${employeeOptions}</select></label><label>領用案場（與員工擇一）<select name="site_id"><option value="">不指定案場</option>${siteOptions}</select></label><label>實際領取人<input name="receiver_name"></label><label>用途<input name="purpose" value="新進／勤務物品領用"></label><label class="wide">備註<textarea name="note"></textarea></label></div><div class="batch-lines-head"><h4>領取物品</h4><button type="button" class="mini-button" id="addBatchLine">＋ 增加品項</button></div><div id="batchLines"></div><p id="batchMessage" class="form-message"></p><div class="dialog-actions"><button type="button" class="btn ghost batch-close">取消</button><button type="submit" class="btn primary">儲存整張領取單</button></div></form>`;const lines=$('#batchLines'),addLine=()=>{const div=document.createElement('div');div.className='batch-line';div.innerHTML=`<select class="batch-item" required><option value="">選擇物品</option>${state.relations.inventory_items.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${esc(x.item_code)}－${esc(x.item_name)}（庫存 ${esc(x.current_stock)} ${esc(x.unit)}）</option>`).join('')}</select><input class="batch-quantity" type="number" min="0.01" step="any" value="1" required><button type="button" class="mini-button danger">移除</button>`;div.querySelector('button').onclick=()=>div.remove();lines.appendChild(div)};addLine();$('#addBatchLine').onclick=addLine;dialog.querySelectorAll('.batch-close').forEach(x=>x.onclick=()=>dialog.close());$('#batchIssueForm').onsubmit=saveBatchIssue;dialog.showModal();}
  async function saveBatchIssue(event){event.preventDefault();const form=new FormData(event.currentTarget),employeeId=form.get('employee_id'),siteId=form.get('site_id'),message=$('#batchMessage'),lines=$$('.batch-line');if(Boolean(employeeId)===Boolean(siteId)){message.textContent='請選擇一位領用員工或一個領用案場，兩者只能擇一。';return}if(!lines.length){message.textContent='請至少新增一項物品。';return}const common={transaction_type:'issue',transaction_date:form.get('transaction_date'),document_no:form.get('document_no'),employee_id:employeeId||null,site_id:siteId||null,receiver_name:form.get('receiver_name')||null,purpose:form.get('purpose')||null,note:form.get('note')||null},records=lines.map(line=>({...common,item_id:line.querySelector('.batch-item').value,quantity:Number(line.querySelector('.batch-quantity').value)}));if(records.some(x=>!x.item_id||!x.quantity)){message.textContent='請完整選擇每項物品與數量。';return}message.textContent='正在儲存並扣除庫存…';const{error}=await client.from('inventory_transactions').insert(records);if(error){message.textContent=`儲存失敗：${error.message}`;return}$('#batchIssueDialog').close();showNotice(`領取單 ${common.document_no} 已建立，共 ${records.length} 項物品。`,'success');await renderCurrent();}

  async function renderTable(view) {
    await loadRelations(); const table=viewInfo[view][1];
    if(cloudEnabled&&table==='employees'){const{error}=await client.rpc('refresh_all_annual_leave_balances');if(error)throw error;await loadRelations();}
    const rows=await db.list(table); const cols=columns[table];
    const canAdd=!['bullying_complaints','audit_logs'].includes(table);
    $('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h3>${viewInfo[view][0]}</h3><span class="muted">共 ${rows.length} 筆${table==='bullying_complaints'?'（保密資料）':''}</span></div>${canAdd?'<button class="btn primary" id="addRecord">＋ 新增</button>':''}</div>
      <div class="table-wrap"><table><thead><tr>${cols.map(x=>`<th>${x[1]}</th>`).join('')}<th>操作</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${cols.map(([key])=>`<td>${cellHtml(key,row[key])}</td>`).join('')}<td><div class="action-row"><button class="mini-button" data-edit="${esc(row.id)}">編輯</button>${['payroll_records','termination_certificates','salary_advances','inventory_transactions'].includes(table)?`<button class="mini-button" data-print="${esc(row.id)}">列印</button>`:''}${table==='bullying_complaints'?'':`<button class="mini-button danger" data-delete="${esc(row.id)}">刪除</button>`}</div></td></tr>`).join(''):`<tr><td colspan="${cols.length+1}" class="empty">尚無資料。</td></tr>`}</tbody></table></div></article>`;
    if(table==='audit_logs'){$$('.action-row').forEach(row=>row.innerHTML='<span class="muted">唯讀</span>');const download=document.createElement('button'),archive=document.createElement('button');download.className='btn ghost';download.textContent='下載備份';download.onclick=()=>{if(downloadAuditArchive(rows))showNotice(`已下載 ${rows.length} 筆操作紀錄。`,'success')};archive.className='btn primary';archive.textContent='下載並清除雲端';archive.onclick=()=>archiveAndClearAuditLogs(rows);$('.panel-head').append(download,archive);}
    if(canAdd) $('#addRecord').onclick=()=>openDialog(table,null);
    if(table==='inventory_transactions'){const batch=document.createElement('button');batch.className='btn primary';batch.textContent='＋ 批次領用';batch.onclick=openBatchIssueDialog;$('.panel-head').appendChild(batch);}
    $$('[data-edit]').forEach(button=>button.onclick=()=>openDialog(table,rows.find(x=>x.id===button.dataset.edit)));
    $$('[data-delete]').forEach(button=>button.onclick=()=>deleteRecord(table,button.dataset.delete));
    $$('[data-print]').forEach(button=>button.onclick=()=>{const row=rows.find(x=>x.id===button.dataset.print);table==='payroll_records'?printPayroll(row):table==='salary_advances'?printAdvance(row):table==='inventory_transactions'?printInventoryDocument(row):printTermination(row);});
    $$('[data-private-file]').forEach(button=>button.onclick=async()=>{const{data,error}=await client.storage.from('hr-private').createSignedUrl(button.dataset.privateFile,300);if(error)return showNotice(`附件開啟失敗：${error.message}`,'error');window.open(data.signedUrl,'_blank','noopener');});
  }

  function inputFor([name,label,type,required,options],record={}) {
    record = record || {};
    const value=record[name] ?? '';
    if(type==='textarea') return `<label class="wide">${label}<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea></label>`;
    if(type==='site-picker') {
      const selected=new Set(Array.isArray(value)?value:[]);
      return `<fieldset class="wide site-picker"><legend>${label}</legend><div class="site-picker-toolbar"><input type="search" class="site-search" placeholder="輸入案場名稱或代碼搜尋"><button type="button" class="mini-button select-visible-sites" disabled>選取搜尋結果</button><button type="button" class="mini-button clear-sites">清除全部</button></div><div class="site-picker-summary">已選 <strong class="selected-site-count">${selected.size}</strong> 個案場<div class="selected-site-chips"></div></div><div class="site-search-hint">輸入關鍵字後，才會顯示可勾選的案場。</div><div class="site-picker-options">${state.relations.sites.map(site=>`<label class="site-picker-option" data-search="${esc(`${site.code||''} ${site.name}`.toLowerCase())}" hidden><input type="checkbox" name="${name}" value="${esc(site.id)}" data-label="${esc(site.name)}" ${selected.has(site.id)?'checked':''}><span><b>${esc(site.name)}</b><small>${esc(site.code||'')}</small></span></label>`).join('')||'<span class="muted">請先建立案場</span>'}</div></fieldset>`;
    }
    if(type==='feature-picker'){const selected=new Set(Array.isArray(value)?value:[]);return`<fieldset class="wide check-field"><legend>${label}</legend><p class="muted">系統管理員固定擁有全部權限；其他人員依此處勾選。</p><div class="check-grid">${featureOptions.map(([key,text])=>`<label class="check-option"><input type="checkbox" name="${name}" value="${key}" ${selected.has(key)?'checked':''}><span>${text}</span></label>`).join('')}</div></fieldset>`;}
    if(type.startsWith('multi:')) {
      const relation=type.split(':')[1],selected=new Set(Array.isArray(value)?value:[]);
      return `<fieldset class="wide check-field"><legend>${label}</legend><div class="check-grid">${state.relations[relation].map(row=>`<label class="check-option"><input type="checkbox" name="${name}" value="${esc(row.id)}" ${selected.has(row.id)?'checked':''}><span>${esc(row.name||row.full_name)}</span></label>`).join('')||'<span class="muted">請先建立案場</span>'}</div></fieldset>`;
    }
    if(type==='select'||type.startsWith('relation:')) {
      let choices=options;
      if(type.startsWith('relation:')) { const relation=type.split(':')[1]; choices=state.relations[relation].map(row=>[row.id,row.full_name||row.name||row.item_name]); }
      return `<label>${label}<select name="${name}" ${required?'required':''}><option value="">請選擇</option>${(choices||[]).map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    if(type==='readonly') return `<label>${label}<input name="${name}" type="text" value="${esc(value)}" readonly tabindex="-1"><small class="muted">依到職日、標準每日工時與已核准特休自動計算</small></label>`;
    return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any"':''} ${required?'required':''}></label>`;
  }

  async function openDialog(table,record) {
    state.editing={table,id:record?.id||null};
    if(table==='payroll_records'&&!record) record={payroll_month:new Date().toISOString().slice(0,7),basic_salary:0,overtime_pay:0,allowances:0,personal_leave_hours:0,sick_leave_hours:0,unpaid_leave_hours:0,labor_insurance:0,health_insurance:0,group_insurance:0,court_deduction:0,advance_deduction:0,other_deduction:0,status:'draft'};
    if(table==='inventory_items'&&!record)record={unit:'個',minimum_stock:0,status:'active',category:'other'};
    if(table==='inventory_transactions'&&!record)record={transaction_date:new Date().toISOString().slice(0,10),transaction_type:'issue',quantity:1};
    if(table==='vendors'&&!record)record={category:'other',payment_terms:'net_30',status:'active'};
    if(table==='supervisor_inspections'&&!record){const now=new Date();record={inspection_date:now.toISOString().slice(0,10),inspection_time:now.toTimeString().slice(0,5),employee_id:state.user?.employeeId||'',inspection_type:'routine',overall_result:'pass',staff_discipline:'good',post_records:'good',equipment_status:'good',environment_safety:'good',follow_up_status:'none'};}
    if(table==='employees') {
      const assigned=[],permissions=[];
      if(record?.id&&cloudEnabled){const[{data:sites},{data:features}]=await Promise.all([client.from('site_assignments').select('site_id').eq('employee_id',record.id),client.from('employee_feature_permissions').select('feature_key').eq('employee_id',record.id)]);(sites||[]).forEach(x=>assigned.push(x.site_id));(features||[]).forEach(x=>permissions.push(x.feature_key));}
      record={...(record||{}),assigned_sites:assigned,feature_permissions:permissions};
    }
    $('#dialogTitle').textContent=`${record?'編輯':'新增'}${viewInfo[Object.keys(viewInfo).find(k=>viewInfo[k][1]===table)]?.[0]||'資料'}`;
    $('#formFields').innerHTML=fields[table].map(field=>inputFor(field,record)).join('');
    initSitePicker();
    if(table==='payroll_records'&&!state.editing.id) initPayrollAutoFill();
    if(table==='leave_requests') initLeaveBalanceInfo();
    if(table==='employee_payroll_profiles') initAutomaticLeaveRates();
    $('#formMessage').textContent=''; $('#recordDialog').showModal();
  }

  function initSitePicker(){
    const picker=$('.site-picker');if(!picker)return;const search=picker.querySelector('.site-search'),options=[...picker.querySelectorAll('.site-picker-option')],count=picker.querySelector('.selected-site-count'),chips=picker.querySelector('.selected-site-chips'),hint=picker.querySelector('.site-search-hint'),selectVisible=picker.querySelector('.select-visible-sites');
    const refresh=()=>{const checked=options.map(x=>x.querySelector('input')).filter(x=>x.checked);count.textContent=checked.length;chips.innerHTML=checked.slice(0,8).map(x=>`<span>${esc(x.dataset.label)}</span>`).join('')+(checked.length>8?`<em>＋${checked.length-8}</em>`:'');};
    search.oninput=()=>{const q=search.value.trim().toLowerCase();options.forEach(x=>x.hidden=!q||!x.dataset.search.includes(q));hint.hidden=Boolean(q);selectVisible.disabled=!q;};options.forEach(x=>x.querySelector('input').onchange=refresh);selectVisible.onclick=()=>{options.filter(x=>!x.hidden).forEach(x=>x.querySelector('input').checked=true);refresh();};picker.querySelector('.clear-sites').onclick=()=>{options.forEach(x=>x.querySelector('input').checked=false);refresh();};refresh();
  }

  function initPayrollAutoFill(){const employeeInput=$('[name="employee_id"]'),monthInput=$('[name="payroll_month"]');if(!employeeInput||!monthInput)return;const fill=async()=>{const employeeId=employeeInput.value,month=monthInput.value;if(!employeeId||!month)return;$('#formMessage').textContent='正在帶入薪資設定與已核准借支…';const[{data:profile,error:profileError},{data:advances,error:advanceError}]=await Promise.all([client.from('employee_payroll_profiles').select('*').eq('employee_id',employeeId).maybeSingle(),client.from('salary_advances').select('amount').eq('employee_id',employeeId).eq('repayment_month',month).eq('status','approved')]);if(profileError||advanceError){$('#formMessage').textContent=`自動帶入失敗：${(profileError||advanceError).message}`;return}if(!profile){$('#formMessage').textContent='此員工尚未建立薪資設定，請先到「薪資設定」新增。';return}const values={basic_salary:profile.basic_salary,labor_insurance:profile.labor_insurance,health_insurance:profile.health_insurance,group_insurance:profile.group_insurance,advance_deduction:(advances||[]).reduce((sum,row)=>sum+Number(row.amount||0),0)};Object.entries(values).forEach(([name,value])=>{const input=$(`[name="${name}"]`);if(input)input.value=value});$('#formMessage').textContent=`已帶入薪資設定；本月核准借支 ${(advances||[]).length} 筆，共 ${Number(values.advance_deduction).toLocaleString('zh-TW')} 元。`;};employeeInput.onchange=fill;monthInput.onchange=fill;}

  function initLeaveBalanceInfo(){const employeeInput=$('[name="employee_id"]'),typeInput=$('[name="leave_type"]');if(!employeeInput||!typeInput)return;const info=document.createElement('div');info.className='wide muted';info.id='leaveBalanceInfo';$('#formFields').prepend(info);const refresh=async()=>{if(typeInput.value!=='annual'){info.textContent='非特休假別不會扣除特休餘額。';return}if(!employeeInput.value){info.textContent='選擇員工後顯示特休額度。';return}if(!cloudEnabled){const row=state.relations.employees.find(x=>x.id===employeeInput.value);info.textContent=`目前剩餘 ${Number(row?.annual_leave_hours||0)} 小時`;return}info.textContent='正在計算特休額度…';const{error}=await client.rpc('refresh_employee_annual_leave',{target_employee_id:employeeInput.value});if(error){info.textContent=`特休計算失敗：${error.message}`;return}const{data,error:readError}=await client.from('employees').select('annual_leave_entitlement_hours,annual_leave_used_hours,annual_leave_hours,annual_leave_period_start,annual_leave_period_end').eq('id',employeeInput.value).single();info.textContent=readError?`特休讀取失敗：${readError.message}`:`本期 ${Number(data.annual_leave_entitlement_hours||0)} 小時・已休 ${Number(data.annual_leave_used_hours||0)} 小時・剩餘 ${Number(data.annual_leave_hours||0)} 小時（${data.annual_leave_period_start||'—'} 至 ${data.annual_leave_period_end||'—'}）`;};employeeInput.onchange=refresh;typeInput.onchange=refresh;refresh();}

  function initAutomaticLeaveRates(){const salary=$('[name="basic_salary"]'),personal=$('[name="personal_leave_day_rate"]'),sick=$('[name="sick_leave_day_rate"]');if(!salary||!personal||!sick)return;const calculate=()=>{const monthly=Number(salary.value||0);personal.value=(monthly/30).toFixed(2);sick.value=(monthly/60).toFixed(2);$('#formMessage').textContent=monthly?`自動換算：事假每小時 ${(monthly/30/8).toFixed(2)} 元；病假每小時 ${(monthly/30/8/2).toFixed(2)} 元。薪資明細將依實際請假時數計算。`:'';};salary.oninput=calculate;calculate();}

  async function saveRecord(event) {
    event.preventDefault(); const {table,id}=state.editing; const form=new FormData(event.currentTarget); const record=Object.fromEntries(form.entries());
    Object.keys(record).forEach(key=>{if(record[key]==='')record[key]=null});
    const assignedSites=table==='employees'?form.getAll('assigned_sites'):[]; delete record.assigned_sites;
    const featurePermissions=table==='employees'?form.getAll('feature_permissions'):[];delete record.feature_permissions;
    const initialPassword=record.initial_password; delete record.initial_password;
    if(table==='employees'){delete record.annual_leave_entitlement_hours;delete record.annual_leave_used_hours;delete record.annual_leave_hours;delete record.annual_leave_period_start;delete record.annual_leave_period_end;}
    if(table==='employee_payroll_profiles'&&cloudEnabled){delete record.personal_leave_day_rate;delete record.sick_leave_day_rate;}
    if(table==='announcements') record.is_active=record.is_active==='true';
    if(table==='site_assignments') record.is_manager=record.is_manager==='true';
    if(table==='inventory_transactions'&&record.employee_id&&record.site_id){$('#formMessage').textContent='領用員工與領用案場只能選擇其中一項。';return}
    if(table==='inventory_transactions'&&record.transaction_type==='issue'&&!record.employee_id&&!record.site_id){$('#formMessage').textContent='領用出庫時，請選擇領用員工或領用案場。';return}
    if(table==='inventory_transactions'&&record.transaction_type==='purchase'&&!record.vendor_id){$('#formMessage').textContent='採購入庫時，請選擇採購廠商。';return}
    if(table==='supervisor_inspections'&&record.overall_result!=='pass'&&record.follow_up_status==='none'){$('#formMessage').textContent='巡查結果有缺失時，改善追蹤不可選擇「無須改善」。';return}
    if(table==='supervisor_inspections'&&record.follow_up_status==='verified'&&!record.resolved_at){$('#formMessage').textContent='已複查完成時，請填寫完成改善日期。';return}
    $('#saveButton').disabled=true; $('#formMessage').textContent='';
    try {
      const saved=await db.save(table,record,id);
      if(table==='payroll_records'&&cloudEnabled&&['confirmed','paid'].includes(saved.status)&&Number(saved.advance_deduction||0)>0){const{error:advanceError}=await client.from('salary_advances').update({status:'deducted'}).eq('employee_id',saved.employee_id).eq('repayment_month',saved.payroll_month).eq('status','approved');if(advanceError)throw advanceError;}
      if(table==='employees'&&cloudEnabled){
        const{error:deleteError}=await client.from('site_assignments').delete().eq('employee_id',saved.id);if(deleteError)throw deleteError;
        if(assignedSites.length){const startDate=saved.hire_date||new Date().toISOString().slice(0,10);const{error:assignError}=await client.from('site_assignments').insert(assignedSites.map(siteId=>({employee_id:saved.id,site_id:siteId,start_date:startDate,is_manager:saved.role==='site_manager'})));if(assignError)throw assignError;}
        if(state.user.role==='admin'){const{error:permissionDeleteError}=await client.from('employee_feature_permissions').delete().eq('employee_id',saved.id);if(permissionDeleteError)throw permissionDeleteError;if(featurePermissions.length){const{error:permissionInsertError}=await client.from('employee_feature_permissions').insert(featurePermissions.map(featureKey=>({employee_id:saved.id,feature_key:featureKey})));if(permissionInsertError)throw permissionInsertError;}}
      }
      if(table==='employees' && initialPassword && cloudEnabled){
        const {data,error}=await client.functions.invoke('quick-worker',{body:{employee_id:saved.id,password:initialPassword}});
        if(error) throw error;
        if(!data?.ok) throw new Error(data?.error||'登入帳號建立失敗');
      }
      $('#recordDialog').close(); await renderCurrent(); showNotice(table==='employees'&&initialPassword?'員工與登入帳號已建立。':'資料已儲存。','success');
    }
    catch(error) { $('#formMessage').textContent=`儲存失敗：${error.message}`; }
    finally { $('#saveButton').disabled=false; }
  }

  async function deleteRecord(table,id) {
    if(!confirm('確定刪除這筆資料？此動作無法復原。')) return;
    try { await db.remove(table,id); await renderCurrent(); showNotice('資料已刪除。'); } catch(error) { showNotice(`刪除失敗：${error.message}`,'error'); }
  }

  function showNotice(message,type='info') { const n=$('#notice'); n.textContent=message; n.hidden=false; n.style.borderColor=type==='error'?'#e8aaaa':'#b9ddd4'; n.style.background=type==='error'?'#fff0f0':'#eef9f6'; clearTimeout(showNotice.timer); showNotice.timer=setTimeout(()=>n.hidden=true,4500); }
  function monthRange(month){const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate();return{y,m,days,first:`${month}-01`,last:`${month}-${String(days).padStart(2,'0')}`};}
  function moveScheduleMonth(step){const [y,m]=state.scheduleMonth.split('-').map(Number),d=new Date(y,m-1+step,1);state.scheduleMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderMonthlySchedule();}
  async function renderMonthlySchedule(){await loadRelations();const employees=state.relations.employees.filter(x=>x.status==='active'),sites=state.relations.sites.filter(x=>x.status==='active');if(!state.scheduleSite&&sites[0])state.scheduleSite=sites[0].id;const r=monthRange(state.scheduleMonth);let rows=[];if(cloudEnabled&&state.scheduleSite){const{data,error}=await client.from('schedules').select('*').eq('site_id',state.scheduleSite).gte('work_date',r.first).lte('work_date',r.last);if(error)throw error;rows=data||[]}const map=new Map(rows.map(x=>[`${x.employee_id}|${x.work_date}`,x.shift_type])),weekdays=['日','一','二','三','四','五','六'];$('#content').innerHTML=`<article class="panel monthly-panel"><div class="panel-head monthly-tools"><div><h3>整月勤務排班</h3><span class="muted">點格子切換：休 → 日 → 夜</span></div><div class="month-controls"><button class="mini-button" id="prevMonth">‹ 上月</button><strong>${r.y} 年 ${r.m} 月</strong><button class="mini-button" id="nextMonth">下月 ›</button></div><select id="scheduleSite">${sites.map(s=>`<option value="${s.id}" ${s.id===state.scheduleSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select><button class="btn primary" id="saveMonth">儲存整月班表</button></div><div class="monthly-wrap"><table class="monthly-table"><thead><tr><th class="sticky-name">員工</th>${Array.from({length:r.days},(_,i)=>{const day=i+1,d=new Date(r.y,r.m-1,day);return`<th class="${[0,6].includes(d.getDay())?'weekend':''}">${day}<small>${weekdays[d.getDay()]}</small></th>`}).join('')}</tr></thead><tbody>${employees.map(emp=>`<tr><th class="sticky-name">${esc(emp.full_name)}<small>${esc(emp.employee_no)}</small></th>${Array.from({length:r.days},(_,i)=>{const date=`${state.scheduleMonth}-${String(i+1).padStart(2,'0')}`,shift=map.get(`${emp.id}|${date}`)||'';return`<td><button class="shift-cell ${shift}" data-employee="${emp.id}" data-date="${date}" data-shift="${shift}">${shift==='day'?'日':shift==='night'?'夜':'休'}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div></article>`;$('#prevMonth').onclick=()=>moveScheduleMonth(-1);$('#nextMonth').onclick=()=>moveScheduleMonth(1);$('#scheduleSite').onchange=e=>{state.scheduleSite=e.target.value;renderMonthlySchedule()};$$('.shift-cell').forEach(b=>b.onclick=()=>{const next=b.dataset.shift===''?'day':b.dataset.shift==='day'?'night':'';b.dataset.shift=next;b.className=`shift-cell ${next}`;b.textContent=next==='day'?'日':next==='night'?'夜':'休'});$('#saveMonth').onclick=saveMonthlySchedule;}
  async function saveMonthlySchedule(){if(!cloudEnabled||!state.scheduleSite)return;const r=monthRange(state.scheduleMonth);if(!confirm(`確定覆蓋 ${state.scheduleMonth} 這個案場的整月班表？`))return;const records=$$('.shift-cell').filter(b=>b.dataset.shift).map(b=>({employee_id:b.dataset.employee,site_id:state.scheduleSite,work_date:b.dataset.date,shift_type:b.dataset.shift,start_time:b.dataset.shift==='night'?'19:00':'07:00',end_time:b.dataset.shift==='night'?'07:00':'19:00'}));const{error:delError}=await client.from('schedules').delete().eq('site_id',state.scheduleSite).gte('work_date',r.first).lte('work_date',r.last);if(delError){showNotice(delError.message,'error');return}if(records.length){const{error}=await client.from('schedules').insert(records);if(error){showNotice(error.message,'error');return}}showNotice('整月班表已儲存。','success');await renderMonthlySchedule();}
  const scheduleShiftOptions=[['','休'],['day','日班'],['night','夜班'],['mobile','機動班'],['special','特勤班'],['cash','現金班（當日領現）'],['custom','自訂班'],['off','輪休'],['annual','特休'],['personal','事假'],['sick','病假']];
  const scheduleDutyShifts=new Set(['day','night','mobile','special','cash','custom']);
  function moveEmployeeScheduleMonth(step){const[y,m]=state.scheduleMonth.split('-').map(Number),d=new Date(y,m-1+step,1);state.scheduleMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderEmployeeMonthlySchedule();}
  function defaultShiftTime(shift){return({day:'07-19',night:'19-07',mobile:'07-19',special:'08-20',cash:'07-19'})[shift]||'';}
  function parseShiftTime(shift,text){const fallback=defaultShiftTime(shift),raw=(text||fallback).trim(),match=raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:-|－|~|至)\s*(\d{1,2})(?::(\d{2}))?$/);if(!match)return null;const start=`${String(Number(match[1])).padStart(2,'0')}:${match[2]||'00'}`,end=`${String(Number(match[3])).padStart(2,'0')}:${match[4]||'00'}`;return{start,end,text:raw};}
  async function renderEmployeeMonthlySchedule(){
    await loadRelations();const employees=state.relations.employees.filter(x=>x.status==='active'),allSites=state.relations.sites.filter(x=>x.status==='active');if(!state.scheduleEmployee&&employees[0])state.scheduleEmployee=employees[0].id;const range=monthRange(state.scheduleMonth),employee=employees.find(x=>x.id===state.scheduleEmployee);
    let assignmentRows=[],scheduleRows=[];
    if(cloudEnabled&&employee){const[{data:assignments},{data:schedules,error}]=await Promise.all([client.from('site_assignments').select('site_id').eq('employee_id',employee.id).lte('start_date',range.last).or(`end_date.is.null,end_date.gte.${range.first}`),client.from('schedules').select('*').eq('employee_id',employee.id).gte('work_date',range.first).lte('work_date',range.last)]);if(error)throw error;assignmentRows=assignments||[];scheduleRows=schedules||[];}
    const allowedIds=new Set(assignmentRows.map(x=>x.site_id)),eligibleSites=allowedIds.size?allSites.filter(x=>allowedIds.has(x.id)):allSites,scheduleMap=new Map(scheduleRows.map(x=>[x.work_date,x])),weekdays=['日','一','二','三','四','五','六'];
    $('#content').innerHTML=`<article class="panel employee-scheduler"><div class="panel-head scheduler-tools"><div><h3>員工個人整月排班</h3><span class="muted">逐日指定案場、班別與值勤時間</span></div><label>排班同仁<select id="schedulerEmployee">${employees.map(x=>`<option value="${x.id}" ${x.id===state.scheduleEmployee?'selected':''}>${esc(x.employee_no)}－${esc(x.full_name)}${x.employment_type==='mobile'?'（機動）':''}</option>`).join('')}</select></label><div class="month-controls"><button class="mini-button" id="employeePrevMonth">‹ 上月</button><strong>${range.y} 年 ${range.m} 月</strong><button class="mini-button" id="employeeNextMonth">下月 ›</button></div><button class="btn primary" id="saveEmployeeMonth">儲存並發布整月班表</button></div>${employee&&!allowedIds.size?'<div class="schedule-warning">此員工尚未設定可排班案場，目前暫時顯示全部案場。請到「員工管理」編輯並勾選案場。</div>':''}<div class="table-wrap"><table class="daily-schedule-table"><thead><tr><th>日期／星期</th><th>指派案場</th><th>指派班別</th><th>值勤時段</th></tr></thead><tbody>${Array.from({length:range.days},(_,i)=>{const day=i+1,date=`${state.scheduleMonth}-${String(day).padStart(2,'0')}`,d=new Date(range.y,range.m-1,day),row=scheduleMap.get(date)||{},weekend=[0,6].includes(d.getDay());return`<tr class="${weekend?'weekend-row':''}" data-date="${date}"><td><strong>${String(day).padStart(2,'0')} 日</strong><small>週${weekdays[d.getDay()]}</small></td><td><select class="daily-site"><option value="">不指定案場</option>${eligibleSites.map(s=>`<option value="${s.id}" ${s.id===row.site_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td><select class="daily-shift">${scheduleShiftOptions.map(([v,t])=>`<option value="${v}" ${v===(row.shift_type||'')?'selected':''}>${t}</option>`).join('')}</select></td><td><input class="daily-time" value="${esc(row.work_time_text||((row.start_time&&row.end_time)?`${String(row.start_time).slice(0,5)}-${String(row.end_time).slice(0,5)}`:''))}" placeholder="例如 07-19"></td></tr>`}).join('')}</tbody></table></div></article>`;
    const cashRows=scheduleRows.filter(row=>row.shift_type==='cash');if(cashRows.length)$('.employee-scheduler').insertAdjacentHTML('beforeend',`<article class="cash-shift-summary"><h4>本月現金班領取紀錄</h4>${cashRows.map(row=>`<div class="quick-item"><div><strong>${esc(row.work_date)} · NT$ ${Number(row.cash_amount||0).toLocaleString('zh-TW')}</strong><small>${esc(format('site_id',row.site_id))}${row.cash_paid_at?` · ${esc(String(row.cash_paid_at).replace('T',' ').slice(0,16))}`:''}</small></div><span class="badge ${row.cash_payment_status==='paid'?'':'warning'}">${row.cash_payment_status==='paid'?'已領現':'待領現'}</span></div>`).join('')}</article>`);$$('.daily-schedule-table tbody tr').forEach(tr=>{const row=scheduleMap.get(tr.dataset.date);tr.dataset.cashAmount=String(row?.cash_amount||employee?.cash_shift_default_amount||0)});$('#schedulerEmployee').onchange=e=>{state.scheduleEmployee=e.target.value;renderEmployeeMonthlySchedule()};$('#employeePrevMonth').onclick=()=>moveEmployeeScheduleMonth(-1);$('#employeeNextMonth').onclick=()=>moveEmployeeScheduleMonth(1);$$('.daily-shift').forEach(select=>select.onchange=()=>{const tr=select.closest('tr'),input=tr.querySelector('.daily-time');if(!input.value)input.value=defaultShiftTime(select.value);if(select.value==='cash'){const amount=prompt('請確認此班現金領取金額',tr.dataset.cashAmount||employee?.cash_shift_default_amount||0);if(amount!==null&&Number(amount)>=0)tr.dataset.cashAmount=String(Number(amount))}});$('#saveEmployeeMonth').onclick=saveEmployeeMonthlySchedule;
  }
  async function saveEmployeeMonthlySchedule(){
    if(!cloudEnabled||!state.scheduleEmployee)return;const range=monthRange(state.scheduleMonth),records=[],employee=state.relations.employees.find(x=>x.id===state.scheduleEmployee);
    for(const tr of $$('.daily-schedule-table tbody tr')){const shift=tr.querySelector('.daily-shift').value,siteId=tr.querySelector('.daily-site').value,timeText=tr.querySelector('.daily-time').value;if(!shift)continue;if(scheduleDutyShifts.has(shift)&&!siteId){showNotice(`${tr.dataset.date} 請選擇值勤案場。`,'error');return}const times=parseShiftTime(shift,timeText)||{start:'00:00',end:'00:00',text:''};if(scheduleDutyShifts.has(shift)&&!parseShiftTime(shift,timeText)){showNotice(`${tr.dataset.date} 時段格式錯誤，請輸入例如 07-19。`,'error');return}records.push({employee_id:state.scheduleEmployee,site_id:scheduleDutyShifts.has(shift)?siteId:null,work_date:tr.dataset.date,shift_type:shift,start_time:times.start,end_time:times.end,work_time_text:scheduleDutyShifts.has(shift)?times.text:'',cash_amount:shift==='cash'?Number(tr.dataset.cashAmount||employee?.cash_shift_default_amount||0):0,cash_payment_status:shift==='cash'?'pending':'none'});}
    if(!confirm(`確定覆蓋此員工 ${state.scheduleMonth} 的整月班表？`))return;const{error:deleteError}=await client.from('schedules').delete().eq('employee_id',state.scheduleEmployee).gte('work_date',range.first).lte('work_date',range.last);if(deleteError){showNotice(deleteError.message,'error');return}if(records.length){const{error}=await client.from('schedules').insert(records);if(error){showNotice(error.message,'error');return}}showNotice('員工整月班表已儲存並發布。','success');await renderEmployeeMonthlySchedule();
  }
  function moveAttendanceMonth(step){const[y,m]=state.attendanceMonth.split('-').map(Number),d=new Date(y,m-1+step,1);state.attendanceMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderAttendanceRecords();}
  function attendanceTime(value){if(!value)return'—';return new Date(value).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
  function attendanceHours(row){if(!row.clock_in||!row.clock_out)return 0;return Math.max(0,(new Date(row.clock_out)-new Date(row.clock_in))/3600000);}
  function downloadAttendanceCsv(rows,summaries,site,range){if(!rows.length)return showNotice('此案場本月沒有可下載的打卡紀錄。','error');const csv=v=>`"${String(v??'').replace(/"/g,'""')}"`,status={normal:'正常',late:'遲到',missing:'缺卡'},lines=[['紘嘉物業保全股份有限公司 案場打卡紀錄'],['案場',site?.name||''],['統計月份',`${range.y}年${range.m}月`],['匯出時間',new Date().toLocaleString('zh-TW')],[],['本月人員統整'],['工號','姓名','出勤天數','完整打卡','遲到','缺卡／異常','值勤時數'],...summaries.map(x=>[x.employee?.employee_no,x.employee?.full_name,x.days,x.completed,x.late,x.missing,x.hours.toFixed(1)]),[],['每日打卡明細'],['日期','工號','姓名','上班時間','下班時間','值勤時數','狀態','上班GPS','下班GPS'],...[...rows].sort((a,b)=>String(a.work_date).localeCompare(String(b.work_date))||String(a.clock_in||'').localeCompare(String(b.clock_in||''))).map(x=>[x.work_date,x.employees?.employee_no,x.employees?.full_name,attendanceTime(x.clock_in),attendanceTime(x.clock_out),attendanceHours(x).toFixed(1),status[x.status]||x.status,x.clock_in_lat!=null?`${x.clock_in_lat}, ${x.clock_in_lng}`:'',x.clock_out_lat!=null?`${x.clock_out_lat}, ${x.clock_out_lng}`:''])];const content='\ufeff'+lines.map(line=>line.map(csv).join(',')).join('\r\n'),blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a'),safe=String(site?.name||'案場').replace(/[\\/:*?"<>|]/g,'_');a.href=url;a.download=`${state.attendanceMonth}_${safe}_打卡紀錄.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showNotice('打卡紀錄已下載，可使用 Excel 開啟。','success');}
  async function renderAttendanceRecords(){
    await loadRelations();const sites=state.relations.sites.filter(x=>x.status==='active');if(!state.attendanceSite&&sites[0])state.attendanceSite=sites[0].id;const range=monthRange(state.attendanceMonth);let rows=[];
    if(cloudEnabled&&state.attendanceSite){const{data,error}=await client.from('attendance').select('*,employees(employee_no,full_name)').eq('site_id',state.attendanceSite).gte('work_date',range.first).lte('work_date',range.last).order('work_date',{ascending:false}).order('clock_in',{ascending:false});if(error)throw error;rows=data||[];}else if(!cloudEnabled){const employees=state.relations.employees;rows=(await db.list('attendance')).filter(x=>x.site_id===state.attendanceSite&&x.work_date>=range.first&&x.work_date<=range.last).map(x=>({...x,employees:employees.find(e=>e.id===x.employee_id)}));}
    const summary=new Map();for(const row of rows){const id=row.employee_id,current=summary.get(id)||{employee:row.employees,days:0,completed:0,late:0,missing:0,hours:0};current.days++;if(row.clock_in&&row.clock_out)current.completed++;if(row.status==='late')current.late++;if(!row.clock_in||!row.clock_out||row.status==='missing')current.missing++;current.hours+=attendanceHours(row);summary.set(id,current);}const summaries=[...summary.values()].sort((a,b)=>(a.employee?.employee_no||'').localeCompare(b.employee?.employee_no||''));const completed=rows.filter(x=>x.clock_in&&x.clock_out).length,missing=rows.filter(x=>!x.clock_in||!x.clock_out||x.status==='missing').length,totalHours=rows.reduce((n,x)=>n+attendanceHours(x),0);
    $('#content').innerHTML=`<div class="attendance-toolbar panel"><div><h3>案場打卡紀錄</h3><span class="muted">依案場與月份查詢上下班紀錄</span></div><label>選擇案場<select id="attendanceSite">${sites.map(s=>`<option value="${s.id}" ${s.id===state.attendanceSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><div class="month-controls"><button class="mini-button" id="attendancePrev">‹ 上月</button><strong>${range.y} 年 ${range.m} 月</strong><button class="mini-button" id="attendanceNext">下月 ›</button></div></div><div class="stats attendance-stats"><article class="stat-card"><small>打卡筆數</small><strong>${rows.length}</strong><em>本月紀錄</em></article><article class="stat-card"><small>完成上下班</small><strong>${completed}</strong><em>完整紀錄</em></article><article class="stat-card"><small>缺卡／異常</small><strong>${missing}</strong><em>需要確認</em></article><article class="stat-card"><small>總值勤時數</small><strong>${totalHours.toFixed(1)}</strong><em>小時</em></article></div><article class="panel attendance-summary"><div class="panel-head"><h3>本月人員統整</h3><span class="muted">${summaries.length} 位同仁</span></div><div class="table-wrap"><table><thead><tr><th>工號</th><th>姓名</th><th>出勤天數</th><th>完整打卡</th><th>遲到</th><th>缺卡／異常</th><th>值勤時數</th></tr></thead><tbody>${summaries.length?summaries.map(x=>`<tr><td>${esc(x.employee?.employee_no)}</td><td><strong>${esc(x.employee?.full_name)}</strong></td><td>${x.days}</td><td>${x.completed}</td><td>${x.late}</td><td>${x.missing}</td><td>${x.hours.toFixed(1)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">此月份尚無打卡資料</td></tr>'}</tbody></table></div></article><article class="panel attendance-detail"><div class="panel-head"><h3>每日打卡明細</h3><span class="muted">最新紀錄優先</span></div><div class="table-wrap"><table><thead><tr><th>日期</th><th>員工</th><th>上班</th><th>下班</th><th>時數</th><th>狀態</th><th>GPS 座標</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.work_date)}</td><td><strong>${esc(x.employees?.full_name)}</strong><small>${esc(x.employees?.employee_no)}</small></td><td>${esc(attendanceTime(x.clock_in))}</td><td>${esc(attendanceTime(x.clock_out))}</td><td>${attendanceHours(x).toFixed(1)}</td><td>${badge(x.status)}</td><td><small>${x.clock_in_lat!=null?`${esc(x.clock_in_lat)}, ${esc(x.clock_in_lng)}`:'—'}</small></td></tr>`).join(''):'<tr><td colspan="7" class="empty">此案場本月尚無打卡資料</td></tr>'}</tbody></table></div></article>`;
    const downloadButton=document.createElement('button');downloadButton.id='downloadAttendance';downloadButton.className='btn primary';downloadButton.textContent='下載打卡紀錄';$('.attendance-toolbar').appendChild(downloadButton);
    $('#attendanceSite').onchange=e=>{state.attendanceSite=e.target.value;renderAttendanceRecords()};$('#attendancePrev').onclick=()=>moveAttendanceMonth(-1);$('#attendanceNext').onclick=()=>moveAttendanceMonth(1);downloadButton.onclick=()=>downloadAttendanceCsv(rows,summaries,sites.find(x=>x.id===state.attendanceSite),range);
  }
  async function renderCurrent() { try { state.view==='dashboard'?await renderDashboard():state.view==='schedules'?await renderEmployeeMonthlySchedule():state.view==='attendance'?await renderAttendanceRecords():state.view==='tenderQuotations'?await window.TenderQuotes.render():await renderTable(state.view); } catch(error) { $('#content').innerHTML=`<article class="panel empty">載入失敗：${esc(error.message)}</article>`; } }
  function switchView(view) {if(state.user?.role!=='admin'&&view!=='dashboard'&&!state.user?.permissions?.includes(view)){showNotice('您沒有此功能的使用權限。','error');return}state.view=view; $('#pageTitle').textContent=viewInfo[view][0]; $$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));const active=$(`[data-view="${view}"]`),group=active?.closest('.nav-group');if(group){group.dataset.open='true';group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded','true')}renderCurrent(); }

  function staffLoginEmail(value){const text=String(value||'').trim();if(text.includes('@'))return text.toLowerCase();const normalized=text.toLowerCase().replace(/[^a-z0-9._-]/g,'');if(!normalized)throw Error('請輸入員工工號');return`${normalized}@employee.hongjia.local`;}
  async function loadSignedInUser(authUser){const[{data:profile},{data:employee}]=await Promise.all([client.from('profiles').select('*').eq('id',authUser.id).maybeSingle(),client.from('employees').select('id,employee_no,full_name,role').eq('user_id',authUser.id).maybeSingle()]);let permissions=[];if(employee){const{data}=await client.from('employee_feature_permissions').select('feature_key').eq('employee_id',employee.id);permissions=(data||[]).map(x=>x.feature_key)}state.user={email:authUser.email,name:employee?.full_name||profile?.full_name||authUser.email,role:profile?.role||employee?.role||'guard',employeeId:employee?.id,permissions};}
  function applyNavigationPermissions(){const all=state.user?.role==='admin',allowed=new Set(state.user?.permissions||[]);$$('[data-view]').forEach(button=>button.hidden=!all&&button.dataset.view!=='dashboard'&&!allowed.has(button.dataset.view));$$('.nav-group').forEach(group=>group.hidden=![...group.querySelectorAll('.nav-submenu [data-view]')].some(button=>!button.hidden));}
  async function login(identifier,password) {
    if (!cloudEnabled) throw new Error('尚未連接 Supabase，請改用示範模式。');
    const {data,error}=await client.auth.signInWithPassword({email:staffLoginEmail(identifier),password}); if(error) throw Error('工號、Email 或密碼錯誤');
    await loadSignedInUser(data.user);enterApp();
  }

  function enterApp(demo=false) {
    if(demo) state.user={name:'示範管理員',email:'demo@local',role:'admin',permissions:[]};
    $('#loginView').hidden=true; $('#appView').hidden=false; $('#userName').textContent=state.user.name; $('#userInitial').textContent=state.user.name.slice(0,1);
    $('#modeLabel').textContent=cloudEnabled&&!demo?'雲端模式':'本機示範模式';applyNavigationPermissions();switchView('dashboard');
  }

  async function logout() { if(cloudEnabled) await client.auth.signOut(); state.user=null; $('#appView').hidden=true; $('#loginView').hidden=false; }

  $('#loginForm').addEventListener('submit',async event=>{event.preventDefault();$('#loginMessage').textContent='';try{await login($('#email').value,$('#password').value)}catch(error){$('#loginMessage').textContent=error.message}});
  $('#demoButton').onclick=()=>enterApp(true); $('#logoutButton').onclick=logout; $('#recordForm').addEventListener('submit',saveRecord);
  $$('[data-close-dialog]').forEach(button=>button.onclick=()=>$('#recordDialog').close());
  $$('[data-view]').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
  $$('.nav-group-toggle').forEach(button=>button.onclick=()=>{const group=button.closest('.nav-group'),open=group.dataset.open==='true';group.dataset.open=String(!open);button.setAttribute('aria-expanded',String(!open));});
  if('serviceWorker' in navigator && location.protocol!=='file:') window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  if(cloudEnabled) client.auth.getSession().then(async({data})=>{if(data.session){await loadSignedInUser(data.session.user);enterApp();}});
})();
