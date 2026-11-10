import { SURAH_PAGES } from './surah-pages';

/** Permintaan membuka Mushaf dari layar lain (Setoran, Progress, dst). */
export type MushafTarget = {
  tab?: 'baca' | 'peta';
  /** Untuk tab peta: siswa yang dilihat. */
  santriId?: number;
  /** Untuk tab baca: rentang ayat yang disorot (nomor surah). */
  surah?: number; ayat?: number; surahSelesai?: number; ayatSelesai?: number;
  label?: string;
  /** false = hanya pindah ke halaman, tanpa sorotan. */
  soroti?: boolean;
};

export function surahNo(nama: string | null | undefined): number | null {
  const s = SURAH_PAGES.find((x) => x[1] === String(nama || ''));
  return s ? s[0] : null;
}

/** Dari teks "Al-Fajr : Ayat 14" menjadi target. */
export function targetDariTeksCapaian(teks: string | null | undefined): MushafTarget | null {
  const m = /^(.+?)\s*:\s*Ayat\s+(\d+)/i.exec(String(teks || ''));
  if (!m) return null;
  const no = surahNo(m[1].trim());
  return no ? { surah: no, ayat: Number(m[2]), label: String(teks) } : null;
}
