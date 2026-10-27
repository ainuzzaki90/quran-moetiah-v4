import { getSupabaseAdmin } from './supabase';

/** Id Halaqah Pagi (default untuk data lama / jika tidak dipilih). */
export async function getDefaultHalaqahId(): Promise<number | null> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('halaqah').select('id').eq('aktif', true).order('urutan').limit(1).maybeSingle();
  return data ? data.id : null;
}

/**
 * Membaca parameter filter halaqah dari query string.
 * - tidak ada / 'semua' / 'all' -> null (tanpa filter)
 * - angka -> id halaqah
 */
export function parseHalaqahParam(v: string | null | undefined): string | null {
  if (!v || v === 'semua' || v === 'all') return null;
  return String(v);
}

export async function getHalaqahMap(): Promise<Record<string, any>> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('halaqah').select('*');
  const map: Record<string, any> = {};
  (data || []).forEach((h) => { map[String(h.id)] = h; });
  return map;
}
