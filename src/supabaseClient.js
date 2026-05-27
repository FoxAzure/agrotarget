// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Coloque a URL do seu projeto
const supabaseUrl = 'https://qafvtisfarabhktnoyvt.supabase.co';
// ATENÇÃO: Aqui você usa a chave PUBLISHABLE (anon key), NUNCA a secret key!
const supabaseAnonKey = 'sb_publishable_8emkLToexNu0evdviJVm8g_se_S55GT'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);