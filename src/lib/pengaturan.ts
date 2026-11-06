import { getSupabaseAdmin } from './supabase';
import { Bobot, DEFAULT_BOBOT, DEFAULT_POIN_PER_HALAMAN, DEFAULT_HALAMAN_JILID, DEFAULT_SYARAT_UJIAN, SyaratUjian, LEVEL_JILID_UMMI } from './helpers';

export async function getPengaturan(): Promise<{ bobot: Bobot; poin_per_halaman: number; halaman_per_jilid: Record<string, number>; syarat_ujian: SyaratUjian }> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('pengaturan').select('kunci, nilai');
  const map: Record<string, any> = {};
  (data || []).forEach((r) => { map[r.kunci] = r.nilai; });
  const b = map['bobot_penilaian'];
  const bobot: Bobot = b && typeof b === 'object'
    ? {
        makharij: Number(b.makharij ?? DEFAULT_BOBOT.makharij),
        tajwid: Number(b.tajwid ?? DEFAULT_BOBOT.tajwid),
        kelancaran: Number(b.kelancaran ?? DEFAULT_BOBOT.kelancaran),
        ketepatan: Number(b.ketepatan ?? DEFAULT_BOBOT.ketepatan),
      }
    : DEFAULT_BOBOT;
  const poin = Number(map['poin_per_halaman']);
  const hj = map['halaman_per_jilid'];
  const halaman_per_jilid: Record<string, number> = { ...DEFAULT_HALAMAN_JILID };
  if (hj && typeof hj === 'object') {
    LEVEL_JILID_UMMI.forEach((j) => { const v = Number(hj[j]); if (!isNaN(v) && v > 0) halaman_per_jilid[j] = v; });
  }
  const sy = map['syarat_ujian'];
  const syarat_ujian: SyaratUjian = {
    rata_min: Number(sy?.rata_min ?? DEFAULT_SYARAT_UJIAN.rata_min),
    jumlah_setoran: Number(sy?.jumlah_setoran ?? DEFAULT_SYARAT_UJIAN.jumlah_setoran),
    nilai_halaman_akhir: Number(sy?.nilai_halaman_akhir ?? DEFAULT_SYARAT_UJIAN.nilai_halaman_akhir),
  };
  return { bobot, poin_per_halaman: isNaN(poin) ? DEFAULT_POIN_PER_HALAMAN : poin, halaman_per_jilid, syarat_ujian };
}
