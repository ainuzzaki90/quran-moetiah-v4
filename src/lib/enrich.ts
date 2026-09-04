import { getSupabaseAdmin } from './supabase';

/**
 * Menambahkan nama_siswa, kelas_nama, dan guru_pengampu ke tiap baris setoran.
 * guru_pengampu diambil dari penyimak yang mencatat baris itu (penyimak_id di
 * baris setoran); kalau kosong, fallback ke penyimak binaan tetap siswa itu
 * (tabel penyimak_santri).
 */
export async function enrichSetoranRows(rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  const db = getSupabaseAdmin();

  const santriIds = Array.from(new Set(rows.map((r) => r.santri_id)));
  const { data: santriRows } = await db.from('santri').select('id, nama, kelas_id').in('id', santriIds);
  const santriMap: Record<string, any> = {};
  (santriRows || []).forEach((s) => { santriMap[String(s.id)] = s; });

  const kelasIds = Array.from(new Set((santriRows || []).map((s) => s.kelas_id).filter(Boolean)));
  const { data: kelasRows } = kelasIds.length ? await db.from('kelas').select('id, nama_kelas').in('id', kelasIds) : { data: [] };
  const kelasMap: Record<string, string> = {};
  (kelasRows || []).forEach((k) => { kelasMap[String(k.id)] = k.nama_kelas; });

  const userIds = Array.from(new Set(rows.map((r) => r.penyimak_id).filter(Boolean)));
  const { data: userRows } = userIds.length ? await db.from('users').select('id, nama').in('id', userIds) : { data: [] };
  const userMap: Record<string, string> = {};
  (userRows || []).forEach((u) => { userMap[String(u.id)] = u.nama; });

  // Fallback: penyimak binaan tetap (kalau baris setoran tidak punya penyimak_id)
  const { data: binaanAll } = await db.from('penyimak_santri').select('*');
  const binaanMap: Record<string, string> = {};
  (binaanAll || []).forEach((b) => {
    if (userMap[String(b.penyimak_id)]) binaanMap[String(b.santri_id)] = userMap[String(b.penyimak_id)];
  });

  return rows.map((r) => {
    const s = santriMap[String(r.santri_id)];
    return {
      ...r,
      nama_siswa: s ? s.nama : '-',
      kelas_nama: s && s.kelas_id ? kelasMap[String(s.kelas_id)] || '-' : '-',
      guru_pengampu: (r.penyimak_id && userMap[String(r.penyimak_id)]) || binaanMap[String(r.santri_id)] || '-',
    };
  });
}
