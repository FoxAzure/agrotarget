import { createClient } from '@supabase/supabase-js';

// CONEXÃO DIRETA PARA TESTE RÁPIDO
// Depois, se quiser, migramos isso para .env
const supabaseUrl = 'https://ytlrtanwsslkehdphoti.supabase.co';
const supabaseAnonKey = 'sb_publishable_YyrFy-ZUBKLCeHx0w8ApYw_ILZ8H16I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-client-info': 'agrotarget-coacenter-web',
    },
  },
});