import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new Error('缺少登入憑證')

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await caller.auth.getUser()
    if (userError || !user) throw new Error('登入已失效')
    const { data: profile, error: profileError } = await caller.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || !['admin', 'hr'].includes(profile?.role)) throw new Error('只有管理員或人事可以建立帳號')

    const { employee_id, password } = await req.json()
    if (!employee_id || typeof password !== 'string' || password.length < 8) throw new Error('初始密碼至少需要 8 個字元')

    const admin = createClient(url, serviceKey)
    const { data: employee, error: employeeError } = await admin.from('employees').select('id,employee_no,full_name,user_id').eq('id', employee_id).single()
    if (employeeError || !employee) throw new Error('找不到員工資料')

    const email = `${employee.employee_no.trim().toLowerCase()}@employee.hongjia.local`
    let authUserId = employee.user_id
    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, { password, email, email_confirm: true, user_metadata: { full_name: employee.full_name } })
      if (error) throw error
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: employee.full_name } })
      if (error) throw error
      authUserId = data.user.id
      const { error: linkError } = await admin.from('employees').update({ user_id: authUserId }).eq('id', employee.id)
      if (linkError) throw linkError
    }

    return Response.json({ ok: true, user_id: authUserId }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : '未知錯誤' }, { status: 400, headers: corsHeaders })
  }
})
