import { createClient } from '@supabase/supabase-js';

let supabaseSingleton: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (supabaseSingleton) return supabaseSingleton;
  
  // デバッグ用ログ
  console.log('Environment variables check:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }
  
  if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
  }
  
  supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseSingleton;
}

