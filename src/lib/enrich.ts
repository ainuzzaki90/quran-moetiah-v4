import { getSupabaseAdmin } from './supabase';
import { getHalaqahMap } from './halaqah';

/**
 * Menambahkan nama_siswa, kelas_nama, halaqah_nama, dan guru_pengampu ke tiap baris setoran.
 * guru_pengampu diambil dari penyimak yang mencatat baris itu (penyimak_id di baris setoran);
 * kalau kosong, fallback ke penyimak binaan tetap siswa di halaqah itu (tabel penyimak_santri).
 * Semua query dijalankan paralel dan hanya mengambil kolom yang dibutuhkan.
 */
export async function enrichSetoranRows(rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  const db = getSupabaseAdmin();
  const santriIds = Array.from(new Set(rows.map((r) => r.santri_id)));

  const [santriRes, kelasRes, usersRes, binaanRes, halaqahMap] = await Promise.all([
    db.from('santri').select('id, nama, kelas_id').in('id', santriIds),
    db.from('kelas').select('id, nama_kelas'),
    db.from('users').select('id, nama'),
    db.from('penyimak_santri').select('santri_id, penyimak_id, halaqah_id').in('santri_id', santriIds),
    getHalaqahMap(),
  ]);

  const santriMap: Record<string, any> = {};
  (santriRes.data || []).forEach((s) => { santriMap[String(s.id)] = s; });
  const kelasMap: Record<string, string> = {};
  (kelasRes.data || []).forEach((k) => { kelasMap[String(k.id)] = k.nama_kelas; });
  const userMap: Record<string, string> = {};
  (usersRes.data || []).forEach((u) => { userMap[String(u.id)] = u.nama; });
  const binaanMap: Record<string, string> = {};
  (binaanRes.data || []).forEach((b) => {
    if (userMap[String(b.penyimak_id)]) binaanMap[`${b.santri_id}|${b.halaqah_id}`] = userMap[String(b.penyimak_id)];
  });

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
