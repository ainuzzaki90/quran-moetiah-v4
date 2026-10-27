import { getSupabaseAdmin } from './supabase';
import { getHalaqahMap } from './halaqah';

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
  const { data: allUsers } = await db.from('users').select('id, nama');
  const allUserMap: Record<string, string> = {};
  (allUsers || []).forEach((u) => { allUserMap[String(u.id)] = u.nama; });
  (binaanAll || []).forEach((b) => {
    if (allUserMap[String(b.penyimak_id)]) binaanMap[`${b.santri_id}|${b.halaqah_id}`] = allUserMap[String(b.penyimak_id)];
  });
  const halaqahMap = await getHalaqahMap();

  return rows.map((r) => {
    const s = santriMap[String(r.santri_id)];
    return {
      ...r,
      nama_siswa: s ? s.nama : '-',
      kelas_nama: s && s.kelas_id ? kelasMap[String(s.kelas_id)] || '-' : '-',
      halaqah_nama: r.halaqah_id && halaqahMap[String(r.halaqah_id)] ? halaqahMap[String(r.halaqah_id)].nama : '-',
      guru_pengampu: (r.penyimak_id && userMap[String(r.penyimak_id)]) || binaanMap[`${r.santri_id}|${r.halaqah_id}`] || '-',
    };
  });
}
