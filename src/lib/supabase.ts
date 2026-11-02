import { createClient, SupabaseClient } from '@supabase/supabase-js';

// PENTING: client ini HANYA dipakai di server (API routes), memakai
// SUPABASE_SERVICE_ROLE_KEY yang punya akses penuh melewati RLS.
// Jangan pernah mengirim service role key ke browser/client.
// Ini setara dengan Apps Script yang "Execute as: Me" pada versi lama --
// satu-satunya pintu masuk ke data ada di sini.
let cached: SupabaseClient<any, 'public', any> | null = null;

export function getSupabaseAdmin() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di environment variables');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
