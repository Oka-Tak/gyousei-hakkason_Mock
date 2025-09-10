import { createClient } from '@supabase/supabase-js';

let supabaseSingleton: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (supabaseSingleton) return supabaseSingleton;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseSingleton;
}

