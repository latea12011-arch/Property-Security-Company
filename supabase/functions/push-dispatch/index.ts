import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:corsHeaders})

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey=Deno.env.get('VAPID_PRIVATE_KEY')!
    const subject=Deno.env.get('VAPID_SUBJECT')||'mailto:service@hongjia.tw'
    if(!publicKey||!privateKey)throw new Error('尚未設定 Web Push VAPID 金鑰')
    const admin=createClient(url,serviceKey),authorization=req.headers.get('Authorization')||''
    const cronSecret=Deno.env.get('PUSH_CRON_SECRET')||'',isCron=Boolean(cronSecret&&req.headers.get('x-cron-secret')===cronSecret)
    let user:any=null
    if(!isCron){const token=authorization.replace(/^Bearer\s+/i,'');const result=await admin.auth.getUser(token);user=result.data.user;if(!user)throw new Error('登入狀態已失效')}
    const body=await req.json().catch(()=>({})),action=body.action||'dispatch'
    if(action==='daily'){
      if(!isCron)throw new Error('每日提醒只能由排程服務執行')
      const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})
      const{error}=await admin.rpc('queue_daily_shift_reminders',{target_date:date});if(error)throw error
    }
    webpush.setVapidDetails(subject,publicKey,privateKey)
    const{data:notifications,error:notificationError}=await admin.from('app_notifications').select('*').is('pushed_at',null).order('created_at').limit(500)
    if(notificationError)throw notificationError
    let delivered=0,removed=0
    for(const item of notifications||[]){
      const{data:subscriptions,error}=await admin.from('push_subscriptions').select('*').eq('user_id',item.recipient_user_id)
      if(error)continue
      for(const sub of subscriptions||[]){
        try{
          await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:item.title,body:item.body,url:item.target_url||'./mobile.html',tag:item.id}))
          delivered++
        }catch(error:any){
          if([404,410].includes(Number(error?.statusCode))){await admin.from('push_subscriptions').delete().eq('id',sub.id);removed++}
        }
      }
      await admin.from('app_notifications').update({pushed_at:new Date().toISOString()}).eq('id',item.id)
    }
    return json({ok:true,processed:notifications?.length||0,delivered,removed})
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error)},400)}
})
