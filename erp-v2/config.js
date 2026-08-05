// Supabase 公開連線設定。請勿把 service_role 金鑰放在前端。
window.ERP_CONFIG = {
  supabaseUrl: 'https://zplpufpcllxhtnivviyc.supabase.co',
  supabaseAnonKey: 'sb_publishable_iwJGjmCND4tYsA91_3z0ew_f7G-ZCrv',
  // 公開的 Web Push VAPID 金鑰；私鑰僅存於 Supabase Edge Function Secrets。
  pushPublicKey: 'BGab7E2cHaViZaykJRt1dVtYD3IjJDPcmzP_x0YSJjEEo1PL6-90YE-0S8eOVQYgmPlB1WPb9MPOcpp_gl_qdSc'
};
if (!window.ERP_CLIENT && window.supabase) {
  window.ERP_CLIENT = window.supabase.createClient(window.ERP_CONFIG.supabaseUrl, window.ERP_CONFIG.supabaseAnonKey);
}
