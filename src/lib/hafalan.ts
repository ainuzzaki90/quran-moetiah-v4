import { SURAH_PAGES } from './surah-pages';

/** Nilai minimal setoran Hafalan Baru agar surat dihitung hafal. */
export const MIN_NILAI_HAFAL = 75;

const NAME_TO_NO: Record<string, number> = {};
SURAH_PAGES.forEach((s) => { NAME_TO_NO[s[1]] = s[0]; });
const AYAT: Record<number, number> = {};
SURAH_PAGES.forEach((s) => { AYAT[s[0]] = s[3]; });

type Row = { jenis: string; surah?: string | null; ayat_mulai?: any; surah_selesai?: string | null; ayat_selesai?: any; nilai?: any };

/**
 * Menghitung hafalan siswa.
 * - Sumber: setoran jenis "Hafalan Baru" dengan nilai >= MIN_NILAI_HAFAL, ditambah hafalan awal.
 * - Sebuah surat dihitung hafal bila seluruh ayatnya (1..jumlah ayat) sudah tercakup.
 * - Urutan menghafal tradisional: An-Nas (114) -> turun ke An-Naba (78) -> Juz 29 dst.
 *   `berurutan` = banyak surat yang hafal tanpa terputus mulai dari An-Nas.
 */
export function computeHafalan(rows: Row[], awalSurahNos: number[] = []) {
  const covered: Record<number, Set<number>> = {};
  const cover = (no: number, from: number, to: number) => {
    const max = AYAT[no];
    if (!max) return;
    if (!covered[no]) covered[no] = new Set();
    for (let a = Math.max(1, from); a <= Math.min(max, to); a++) covered[no].add(a);
  };

  rows
    .filter((r) => r.jenis === 'Hafalan Baru' && r.nilai !== null && r.nilai !== undefined && Number(r.nilai) >= MIN_NILAI_HAFAL)
    .forEach((r) => {
      const a = NAME_TO_NO[String(r.surah || '')];
      const b = NAME_TO_NO[String(r.surah_selesai || r.surah || '')];
      if (!a || !b) return;
      const am = Number(r.ayat_mulai) || 1;
      const as = Number(r.ayat_selesai) || AYAT[b];
      if (a === b) { cover(a, am, as); return; }
      // Lintas surat: surat awal dari ayat_mulai sampai akhir, surat tengah penuh, surat akhir dari ayat 1 sampai ayat_selesai
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let n = lo; n <= hi; n++) {
        if (n === a) cover(n, am, AYAT[n]);
        else if (n === b) cover(n, 1, as);
        else cover(n, 1, AYAT[n]);
      }
    });

  const hafal = new Set<number>(awalSurahNos);
  Object.keys(covered).forEach((k) => {
    const no = Number(k);
    if (covered[no].size >= AYAT[no]) hafal.add(no);
  });

  // Ayat total: surat hafal penuh + ayat parsial dari surat yang belum penuh
  let totalAyat = 0;
  for (let no = 1; no <= 114; no++) {
    if (hafal.has(no)) totalAyat += AYAT[no];
    else if (covered[no]) totalAyat += covered[no].size;
  }

  let berurutan = 0;
  for (let no = 114; no >= 1 && hafal.has(no); no--) berurutan++;
  const terakhirNo = berurutan ? 114 - berurutan + 1 : 0;
  const terakhirNama = terakhirNo ? SURAH_PAGES[terakhirNo - 1][1] : '';

  return {
    surat_hafal: hafal.size,
    total_ayat: totalAyat,
    berurutan,
    berurutan_label: berurutan ? `An-Nas → ${terakhirNama} (${berurutan} surat)` : '-',
    hafal_nos: Array.from(hafal).sort((x, y) => y - x),
  };
}
