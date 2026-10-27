import { getSupabaseAdmin } from './supabase';

/** Id siswa binaan seorang penyimak. Jika halaqahId diberikan, hanya di halaqah itu. */
export async function getSantriIdsForPenyimak(penyimakId: number, halaqahId?: string | null): Promise<string[]> {
  const db = getSupabaseAdmin();
  let q = db.from('penyimak_santri').select('santri_id').eq('penyimak_id', penyimakId);
  if (halaqahId) q = q.eq('halaqah_id', halaqahId);
  const { data } = await q;
  return Array.from(new Set((data || []).map((r) => String(r.santri_id))));
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
