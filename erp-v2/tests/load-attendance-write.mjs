// 僅供隔離測試專案使用。需要明確設定 ALLOW_ATTENDANCE_WRITE_TEST=YES，禁止對正式專案執行。
import {randomUUID} from 'node:crypto';
const required=['TEST_SUPABASE_URL','TEST_SUPABASE_ANON_KEY','TEST_EMPLOYEE_EMAIL','TEST_EMPLOYEE_PASSWORD','TEST_SITE_ID','TEST_WORK_DATE'];
if(process.env.ALLOW_ATTENDANCE_WRITE_TEST!=='YES')throw Error('安全停止：必須設定 ALLOW_ATTENDANCE_WRITE_TEST=YES');
for(const key of required)if(!process.env[key])throw Error(`缺少 ${key}`);
if(process.env.TEST_SUPABASE_URL.includes('zplpufpcllxhtnivviyc'))throw Error('安全停止：不可對正式 Supabase 專案執行寫入壓測');
const total=Number(process.argv[2]||500),concurrency=Number(process.argv[3]||50),base=process.env.TEST_SUPABASE_URL,headers={apikey:process.env.TEST_SUPABASE_ANON_KEY,'Content-Type':'application/json'};
const login=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers,body:JSON.stringify({email:process.env.TEST_EMPLOYEE_EMAIL,password:process.env.TEST_EMPLOYEE_PASSWORD})});
if(!login.ok)throw Error(`測試帳號登入失敗 ${login.status}`);const token=(await login.json()).access_token;headers.Authorization=`Bearer ${token}`;
let next=0,ok=0,failed=0;const started=performance.now();
async function worker(){while(next<total){const i=next++,body={punch_request_id:randomUUID(),punch_site_id:process.env.TEST_SITE_ID,punch_work_date:process.env.TEST_WORK_DATE,punch_type:i%2?'out':'in',punch_time:new Date().toISOString(),punch_lat:Number(process.env.TEST_LAT),punch_lng:Number(process.env.TEST_LNG),punch_accuracy:10};const r=await fetch(`${base}/rest/v1/rpc/submit_attendance_punch`,{method:'POST',headers,body:JSON.stringify(body)});r.ok?ok++:failed++;}}
await Promise.all(Array.from({length:concurrency},worker));console.log(JSON.stringify({total,concurrency,ok,failed,seconds:((performance.now()-started)/1000).toFixed(2)},null,2));
