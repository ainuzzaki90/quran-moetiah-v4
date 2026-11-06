/**
 * Supabase/PostgREST membatasi 1000 baris per query. Fungsi ini mengambil SEMUA baris
 * dengan membaca per halaman 1000 baris. `build` harus mengembalikan query BARU tiap dipanggil
 * dan memakai .order() yang stabil (mis. order('id')) agar halaman tidak tumpang tindih.
 */
export async function fetchAll<T = any>(build: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}

/** Kolom setoran yang dibutuhkan untuk hitung hafalan/capaian (lebih ringan dari select *). */
export const SETORAN_HAFALAN_COLS =
  'id,santri_id,tanggal,jenis,surah,ayat_mulai,surah_selesai,ayat_selesai,halaman_mulai,halaman_selesai,nilai,predikat,halaqah_id,penyimak_id,created_at';
