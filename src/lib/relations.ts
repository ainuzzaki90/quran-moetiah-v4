import { getSupabaseAdmin } from './supabase';

export async function getSantriIdsForPenyimak(penyimakId: number): Promise<string[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('penyimak_santri').select('santri_id').eq('penyimak_id', penyimakId);
  return (data || []).map((r) => String(r.santri_id));
}

export async function isSantriBinaanPenyimak(santriId: number, penyimakId: number) {
  const ids = await getSantriIdsForPenyimak(penyimakId);
  return ids.includes(String(santriId));
}

export async function getKelasIdSantri(santriId: number): Promise<number | null> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('santri').select('kelas_id').eq('id', santriId).maybeSingle();
  return data ? data.kelas_id : null;
}
