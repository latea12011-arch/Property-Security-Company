import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new Error('缺少登入授權')

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await caller.auth.getUser()
    if (userError || !user) throw new Error('登入狀態已失效，請重新登入')
    const { data: profile, error: profileError } = await caller.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || !['admin', 'hr'].includes(profile?.role)) throw new Error('只有系統管理員或人事人員可以執行此操作')

    const body = await req.json()
    if (body?.action === 'geocode_address') {
      const address = String(body.address || '').trim()
      if (address.length < 3 || address.length > 200) throw new Error('請輸入完整地址（3 至 200 個字）')
      const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
      if (!googleMapsApiKey) throw new Error('尚未設定 Google Maps API 金鑰')

      const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      endpoint.searchParams.set('address', address)
      endpoint.searchParams.set('region', 'tw')
      endpoint.searchParams.set('language', 'zh-TW')
      endpoint.searchParams.set('key', googleMapsApiKey)
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`Google 地址服務連線失敗（${response.status}）`)
      const result = await response.json()
      if (result.status === 'ZERO_RESULTS') return json({ ok: true, candidates: [] })
      if (result.status !== 'OK') {
        const detail = result.error_message ? `：${result.error_message}` : ''
        throw new Error(`Google 地址搜尋失敗（${result.status || 'UNKNOWN'}）${detail}`)
      }
      const candidates = (result.results || []).slice(0, 5).map((item: any) => ({
        address: item.formatted_address,
        latitude: item.geometry?.location?.lat,
        longitude: item.geometry?.location?.lng,
        location_type: item.geometry?.location_type || '',
        partial_match: Boolean(item.partial_match),
        place_id: item.place_id || '',
      })).filter((item: any) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      return json({ ok: true, candidates })
    }

    const { employee_id, password } = body || {}
    if (!employee_id || typeof password !== 'string' || password.length < 8) throw new Error('員工資料或密碼格式不正確，密碼至少需要 8 碼')
    const admin = createClient(url, serviceKey)
    const { data: employee, error: employeeError } = await admin.from('employees').select('id,employee_no,full_name,user_id').eq('id', employee_id).single()
    if (employeeError || !employee) throw new Error('找不到指定的員工資料')

    const email = `${employee.employee_no.trim().toLowerCase()}@employee.hongjia.local`
    let authUserId = employee.user_id as string | null
    if (authUserId) {
      const { data: existing } = await admin.auth.admin.getUserById(authUserId)
      if (!existing?.user) authUserId = null
    }
    if (!authUserId) {
      for (let page = 1; page <= 10 && !authUserId; page += 1) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (listError) throw listError
        authUserId = users.users.find((item) => item.email?.toLowerCase() === email)?.id || null
        if (users.users.length < 1000) break
      }
    }
    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, { password, email, email_confirm: true, ban_duration: 'none', user_metadata: { full_name: employee.full_name } })
      if (error) throw error
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: employee.full_name } })
      if (error) throw error
      authUserId = data.user.id
    }
    const { error: linkError } = await admin.from('employees').update({ user_id: authUserId, status: 'active' }).eq('id', employee.id)
    if (linkError) throw linkError
    return json({ ok: true, user_id: authUserId })
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : String(error || '發生未知錯誤')
    return json({ ok: false, error: message === '{}' ? '操作失敗，請確認 Edge Function 設定' : message }, 400)
  }
})
