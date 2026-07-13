// Supabase 建立完成後，只填入 Project URL 與 Publishable/Anon Key。
// 請勿把 service_role 金鑰放在瀏覽器程式碼中。
window.ERP_CONFIG = {
  supabaseUrl: 'https://zplpufpcllxhtnivviyc.supabase.co',
  supabaseAnonKey: 'sb_publishable_iwJGjmCND4tYsA91_3z0ew_f7G-ZCrv'
};
if (!window.ERP_CLIENT && window.supabase) {
  window.ERP_CLIENT = window.supabase.createClient(window.ERP_CONFIG.supabaseUrl, window.ERP_CONFIG.supabaseAnonKey);
}
