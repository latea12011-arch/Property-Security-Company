import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const MAILBOX=(Deno.env.get('GMAIL_ACCOUNT')||'hongjia.prse@gmail.com').trim().toLowerCase()
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:corsHeaders})
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?Math.floor(value):min))
const decodeBase64Url=(value='')=>{const normalized=value.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);const bytes=Uint8Array.from(atob(padded),char=>char.charCodeAt(0));return new TextDecoder().decode(bytes)}
const encodeBase64Url=(value:string)=>{const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const header=(headers:Array<{name:string,value:string}>=[],name:string)=>headers.find(item=>item.name.toLowerCase()===name.toLowerCase())?.value||''
const cleanHeader=(value:string)=>String(value||'').replace(/[\r\n]+/g,' ').trim()
const senderName=(from:string)=>from.replace(/<[^>]+>/g,'').replace(/^"|"$/g,'').trim()||from
const htmlToText=(html:string)=>html.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\n{3,}/g,'\n\n').trim()

type GmailPart={mimeType?:string;body?:{data?:string};parts?:GmailPart[]}
function messageBody(payload:GmailPart){
  const parts:GmailPart[]=[];const walk=(part:GmailPart)=>{parts.push(part);(part.parts||[]).forEach(walk)};walk(payload)
  const plain=parts.find(part=>part.mimeType==='text/plain'&&part.body?.data);if(plain?.body?.data)return decodeBase64Url(plain.body.data)
  const html=parts.find(part=>part.mimeType==='text/html'&&part.body?.data);if(html?.body?.data)return htmlToText(decodeBase64Url(html.body.data))
  return payload.body?.data?decodeBase64Url(payload.body.data):''
}
async function accessToken(){
  const clientId=Deno.env.get('GMAIL_CLIENT_ID'),clientSecret=Deno.env.get('GMAIL_CLIENT_SECRET'),refreshToken=Deno.env.get('GMAIL_REFRESH_TOKEN')
  if(!clientId||!clientSecret||!refreshToken)throw new Error('公司 Gmail 尚未完成 OAuth 授權設定')
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})})
  const result=await response.json();if(!response.ok||!result.access_token)throw new Error(result.error_description||'Gmail 授權已失效，請重新連結公司信箱');return result.access_token as string
}
async function gmail(path:string,token:string,init:RequestInit={}){const response=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Gmail API ${path}：${result?.error?.message||`錯誤（${response.status}）`}`);return result}
function summary(message:any){const headers=message.payload?.headers||[],from=header(headers,'From');return{id:message.id,threadId:message.threadId,from,fromName:senderName(from),subject:header(headers,'Subject'),date:header(headers,'Date')||new Date(Number(message.internalDate||0)).toISOString(),snippet:message.snippet||'',unread:(message.labelIds||[]).includes('UNREAD')}}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const authorization=req.headers.get('Authorization');if(!authorization)throw new Error('缺少 ERP 登入授權')
    const url=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!
    const caller=createClient(url,anonKey,{global:{headers:{Authorization:authorization}}})
    const{data:{user},error:userError}=await caller.auth.getUser();if(userError||!user)throw new Error('ERP 登入狀態已失效，請重新登入')
    const[{data:profile},{data:employee}]=await Promise.all([caller.from('profiles').select('role').eq('id',user.id).maybeSingle(),caller.from('employees').select('role').eq('user_id',user.id).maybeSingle()])
    if((profile?.role||employee?.role)!=='admin')throw new Error('只有系統管理員可以查看公司郵件')
    const body=await req.json(),action=String(body?.action||'status'),token=await accessToken(),gmailProfile=await gmail('/profile',token)
    if(String(gmailProfile.emailAddress||'').toLowerCase()!==MAILBOX)throw new Error(`Gmail 授權帳號必須是 ${MAILBOX}`)
    if(action==='status')return json({ok:true,mailbox:gmailProfile.emailAddress})
    if(action==='list'){
      const params=new URLSearchParams({maxResults:String(clamp(Number(body.max_results||20),1,50)),labelIds:'INBOX'});if(body.query)params.set('q',String(body.query));if(body.page_token)params.set('pageToken',String(body.page_token))
      const list=await gmail(`/messages?${params}`,token),details=await Promise.all((list.messages||[]).map((item:any)=>gmail(`/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,token)))
      return json({ok:true,mailbox:MAILBOX,messages:details.map(summary),next_page_token:list.nextPageToken||''})
    }
    if(action==='get'){
      const id=String(body.message_id||'');if(!id)throw new Error('缺少郵件編號');const message=await gmail(`/messages/${encodeURIComponent(id)}?format=full`,token),headers=message.payload?.headers||[],from=header(headers,'From')
      if((message.labelIds||[]).includes('UNREAD'))await gmail(`/messages/${encodeURIComponent(id)}/modify`,token,{method:'POST',body:JSON.stringify({removeLabelIds:['UNREAD']})})
      return json({ok:true,message:{...summary(message),from,to:header(headers,'To'),replyTo:header(headers,'Reply-To')||from,body:messageBody(message.payload||{})}})
    }
    if(action==='reply'){
      const id=String(body.message_id||''),threadId=String(body.thread_id||''),replyBody=String(body.body||'').trim();if(!id||!threadId||!replyBody)throw new Error('回覆資料不完整');if(replyBody.length>50000)throw new Error('回覆內容過長，請縮短後再寄送')
      const original=await gmail(`/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,token),headers=original.payload?.headers||[],to=cleanHeader(header(headers,'Reply-To')||header(headers,'From')),originalSubject=cleanHeader(header(headers,'Subject')||'（無主旨）'),subject=/^re:/i.test(originalSubject)?originalSubject:`Re: ${originalSubject}`,messageId=cleanHeader(header(headers,'Message-ID')),references=cleanHeader([header(headers,'References'),messageId].filter(Boolean).join(' '))
      const mailHeaders=[`From: ${MAILBOX}`,`To: ${to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit'];if(messageId)mailHeaders.push(`In-Reply-To: ${messageId}`);if(references)mailHeaders.push(`References: ${references}`)
      const raw=[...mailHeaders,'',replyBody].join('\r\n'),sent=await gmail('/messages/send',token,{method:'POST',body:JSON.stringify({threadId,raw:encodeBase64Url(raw)})});return json({ok:true,id:sent.id,thread_id:sent.threadId})
    }
    throw new Error('不支援的郵件操作')
  }catch(error){console.error('[gmail-mailbox]',error instanceof Error?error.message:String(error));return json({ok:false,error:error instanceof Error?error.message:'郵件服務發生錯誤'},400)}
})
