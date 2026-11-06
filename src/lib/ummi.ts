import { getSupabaseAdmin } from './supabase';
import { fetchAll } from './db-utils';

/** Waktu (ISO) kenaikan jilid terakhir yang LULUS per siswa: { santriId: created_at }. */
export async function getKenaikanTerakhir(): Promise<Record<string, string>> {
  const db = getSupabaseAdmin();
  const rows = await fetchAll<any>(() =>
    db.from('kenaikan_jilid').select('id, santri_id, disahkan_pada, created_at').eq('status', 'lulus').order('id')
  ).catch(() => [] as any[]); // tabel belum dibuat -> abaikan (fitur belum aktif)
  const out: Record<string, string> = {};
  rows.forEach((r) => { out[String(r.santri_id)] = r.disahkan_pada || r.created_at; });
  return out;
}

/**
 * Setoran Metode Ummi sebelum kenaikan jilid terakhir adalah milik jilid sebelumnya, jadi dibuang
 * agar halaman terakhir dimulai lagi dari awal jilid baru. Jenis lain tidak diubah.
 */
export function filterSetoranSejakNaik<T extends { jenis?: string; created_at?: string }>(rows: T[], naikPada?: string): T[] {
  if (!naikPada) return rows;
  const t = new Date(naikPada).getTime();
  return rows.filter((r) => r.jenis !== 'Setoran Metode Ummi' || !r.created_at || new Date(r.created_at).getTime() > t);
}

export type Kesiapan = {
  halaman_terakhir: number | null;
  halaman_akhir_jilid: number | null;
  rata_nilai: number | null;
  jumlah_nilai: number;
  syarat_halaman: boolean;
  syarat_nilai: boolean;
  siap: boolean;
};

/**
 * Hitung kesiapan ujian kenaikan jilid untuk siswa-siswa tertentu (level Jilid 1-6).
 * santriList: [{ id, level_ummi }]. Hanya setoran Ummi sejak kenaikan terakhir yang dihitung.
 */
export async function hitungKesiapan(
  santriList: { id: number; level_ummi: string | null }[],
  pengaturan: { halaman_per_jilid: Record<string, number>; syarat_ujian: { rata_min: number; jumlah_setoran: number; nilai_halaman_akhir: number } },
): Promise<Record<string, Kesiapan>> {
  const db = getSupabaseAdmin();
  const ids = santriList.map((s) => s.id);
  const out: Record<string, Kesiapan> = {};
  if (!ids.length) return out;
  const [rowsAll, naikMap] = await Promise.all([
    fetchAll<any>(() =>
      db.from('setoran').select('id, santri_id, tanggal, halaman_mulai, halaman_selesai, nilai, jenis, created_at')
        .eq('jenis', 'Setoran Metode Ummi').in('santri_id', ids).order('id')
    ),
    getKenaikanTerakhir(),
  ]);
  const by: Record<string, any[]> = {};
  rowsAll.forEach((r) => { (by[String(r.santri_id)] = by[String(r.santri_id)] || []).push(r); });
  const sy = pengaturan.syarat_ujian;
  for (const s of santriList) {
    const key = String(s.id);
    const rows = filterSetoranSejakNaik(by[key] || [], naikMap[key])
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime() || b.id - a.id);
    const akhirJilid = pengaturan.halaman_per_jilid[String(s.level_ummi)] ?? null;
    const hal = (r: any) => { const n = parseInt(String(r.halaman_selesai || r.halaman_mulai || ''), 10); return isNaN(n) ? null : n; };
    const terakhir = rows.length ? hal(rows[0]) : null;
    const nilaiTerakhir = rows.slice(0, sy.jumlah_setoran).map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
    const rata = nilaiTerakhir.length ? Math.round((nilaiTerakhir.reduce((a, b) => a + b, 0) / nilaiTerakhir.length) * 10) / 10 : null;
    const syaratHalaman = akhirJilid !== null && rows.some((r) => {
      const h = parseInt(String(r.halaman_selesai || ''), 10);
      return !isNaN(h) && h >= akhirJilid && Number(r.nilai) >= sy.nilai_halaman_akhir;
    });
    const syaratNilai = rata !== null && rata >= sy.rata_min;
    out[key] = {
      halaman_terakhir: terakhir, halaman_akhir_jilid: akhirJilid, rata_nilai: rata, jumlah_nilai: nilaiTerakhir.length,
      syarat_halaman: syaratHalaman, syarat_nilai: syaratNilai, siap: syaratHalaman && syaratNilai,
    };
  }
  return out;
}
