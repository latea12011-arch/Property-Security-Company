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
    if (body?.action === 'invite_committee') {
      const accessId = String(body.access_id || '')
      const requestedEmail = String(body.email || '').trim().toLowerCase()
      const redirectTo = String(body.redirect_to || '').trim()
      if (!accessId || !requestedEmail || !redirectTo.startsWith('https://')) throw new Error('管委會帳號或返回網址不正確')
      const admin = createClient(url, serviceKey)
      const { data: access, error: accessError } = await admin.from('community_committee_access').select('id,email,member_name,committee_role,site_id,is_active').eq('id', accessId).single()
      if (accessError || !access || !access.is_active || access.email.trim().toLowerCase() !== requestedEmail) throw new Error('找不到有效的管委會社區授權')
      let existingUserId: string | null = null
      for (let page = 1; page <= 10 && !existingUserId; page += 1) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (listError) throw listError
        existingUserId = users.users.find((item) => item.email?.toLowerCase() === requestedEmail)?.id || null
        if (users.users.length < 1000) break
      }
      if (existingUserId) {
        const [{ data: erpProfile }, { data: erpEmployee }] = await Promise.all([
          admin.from('profiles').select('id,role').eq('id', existingUserId).maybeSingle(),
          admin.from('employees').select('id,employee_no,full_name').eq('user_id', existingUserId).maybeSingle(),
        ])
        if (erpProfile || erpEmployee) throw new Error('此 Email 已是 ERP 管理員或員工登入帳號。為避免密碼互相覆蓋，請替管委會委員使用不同 Email。')
        const { error } = await admin.auth.resetPasswordForEmail(requestedEmail, { redirectTo })
        if (error) throw new Error(`設定信寄送失敗：${error.message}`)
      } else {
        const { error } = await admin.auth.admin.inviteUserByEmail(requestedEmail, { redirectTo, data: { member_name: access.member_name, committee_role: access.committee_role, site_id: access.site_id } })
        if (error) throw new Error(`邀請信寄送失敗：${error.message}`)
      }
      return json({ ok: true, mail_action: existingUserId ? 'recovery' : 'invite' })
    }

    if (body?.action === 'delete_committee_permanently') {
      if (profile?.role !== 'admin') throw new Error('只有系統管理員可以永久刪除管委會帳號')
      const accessId = String(body.access_id || '')
      const confirmationEmail = String(body.confirmation_email || '').trim().toLowerCase()
      if (!accessId || !confirmationEmail) throw new Error('缺少刪除確認資料')
      const admin = createClient(url, serviceKey)
      const { data: access, error: accessError } = await admin.from('community_committee_access').select('id,email,member_name').eq('id', accessId).single()
      if (accessError || !access) throw new Error('找不到指定的管委會帳號')
      if (access.email.trim().toLowerCase() !== confirmationEmail) throw new Error('Email 確認不一致，已取消刪除')
      let deletedAuthUser = false
      for (let page = 1; page <= 10; page += 1) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (listError) throw listError
        const authUser = users.users.find((item) => item.email?.toLowerCase() === confirmationEmail)
        if (authUser) {
          const [{ data: erpProfile }, { data: erpEmployee }] = await Promise.all([
            admin.from('profiles').select('id,role').eq('id', authUser.id).maybeSingle(),
            admin.from('employees').select('id,employee_no,full_name').eq('user_id', authUser.id).maybeSingle(),
          ])
          if (!erpProfile && !erpEmployee) {
            const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUser.id)
            if (authDeleteError) throw new Error(`登入帳號刪除失敗：${authDeleteError.message}`)
            deletedAuthUser = true
          }
          break
        }
        if (users.users.length < 1000) break
      }
      // 同一個 Email 可能因重複指派而存在多筆社區授權。永久刪除必須一次
      // 清乾淨，否則使用者重新登入後仍會命中另一筆授權。
      const { data: emailAccessRows, error: emailAccessError } = await admin
        .from('community_committee_access')
        .select('id')
        .ilike('email', confirmationEmail)
      if (emailAccessError) throw new Error(`查詢同 Email 授權失敗：${emailAccessError.message}`)
      const accessIds = (emailAccessRows || []).map((row: { id: string }) => row.id)
      if (!accessIds.includes(accessId)) accessIds.push(accessId)

      const itemDelete = await admin.from('community_committee_items').delete().in('access_id', accessIds)
      if (itemDelete.error && !['42P01','PGRST205'].includes(itemDelete.error.code || '')) throw new Error(`登入帳號已刪除，但建議事項清除失敗：${itemDelete.error.message}`)
      const { error: accessDeleteError } = await admin.from('community_committee_access').delete().in('id', accessIds)
      if (accessDeleteError) throw new Error(`登入帳號已刪除，但社區授權清除失敗：${accessDeleteError.message}`)
      return json({ ok: true, email: confirmationEmail, member_name: access.member_name, deleted_auth_user: deletedAuthUser, deleted_access_count: accessIds.length })
    }

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

    if (body?.action === 'delete_employee_permanently') {
      if (profile?.role !== 'admin') throw new Error('只有系統管理員可以永久刪除員工')
      const employeeId = String(body.employee_id || '')
      const confirmation = String(body.confirmation_employee_no || '').trim().toUpperCase()
      if (!employeeId || !confirmation) throw new Error('請輸入員工編號完成刪除確認')
      const admin = createClient(url, serviceKey)
      const { data: employee, error: employeeError } = await admin.from('employees').select('id,employee_no,full_name,user_id,id_document_path').eq('id', employeeId).single()
      if (employeeError || !employee) throw new Error('找不到指定的員工資料')
      if (employee.user_id === user.id) throw new Error('不能刪除目前正在登入的管理員帳號')
      if (employee.employee_no.trim().toUpperCase() !== confirmation) throw new Error('輸入的員工編號不一致，已取消刪除')
      const { data: openLoans, error: loanError } = await admin.from('inventory_loans').select('document_no').eq('employee_id', employeeId).in('status', ['borrowed', 'lost', 'damaged'])
      if (loanError) throw loanError
      if (openLoans?.length) throw new Error(`仍有 ${openLoans.length} 筆設備未歸還或未結案，請先完成設備歸還`)

      const removeRows = async (table: string) => {
        const { error } = await admin.from(table).delete().eq('employee_id', employeeId)
        if (error && error.code !== '42P01') throw new Error(`${table} 清除失敗：${error.message}`)
      }
      const { error: preserveCashError } = await admin.from('schedules').update({
        employee_id: null,
        employee_no_snapshot: employee.employee_no,
        employee_name_snapshot: employee.full_name,
      }).eq('employee_id', employeeId).eq('shift_type', 'cash').eq('cash_payment_status', 'paid')
      if (preserveCashError) throw new Error(`已領現班次保留失敗：${preserveCashError.message}`)
      for (const table of ['employee_feature_permissions','site_assignments','schedules','attendance','leave_requests','bullying_complaints','employee_payroll_profiles','salary_advances','payroll_records','termination_certificates','supervisor_inspections','inventory_loans']) await removeRows(table)
      const { error: inventoryError } = await admin.from('inventory_transactions').update({ employee_id: null }).eq('employee_id', employeeId)
      if (inventoryError && inventoryError.code !== '42P01') throw new Error(`庫存紀錄解除連結失敗：${inventoryError.message}`)
      if (employee.id_document_path) {
        const { error } = await admin.storage.from('hr-private').remove([employee.id_document_path])
        if (error) throw new Error(`私人證件檔案刪除失敗：${error.message}`)
      }
      const { error: deleteEmployeeError } = await admin.from('employees').delete().eq('id', employeeId)
      if (deleteEmployeeError) throw new Error(`員工主檔刪除失敗：${deleteEmployeeError.message}`)
      if (employee.user_id) {
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(employee.user_id)
        if (authDeleteError) throw new Error(`員工資料已刪除，但登入帳號刪除失敗：${authDeleteError.message}`)
      }
      return json({ ok: true, employee_no: employee.employee_no, full_name: employee.full_name })
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
