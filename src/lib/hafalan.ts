import { SURAH_PAGES } from './surah-pages';
import { PAGE_FIRST_AYAH_ID } from './mushaf-pages';

// Offset nomor ayat global per surat (ayat global = offset + nomor ayat)
const OFFSET: Record<number, number> = {};
(() => { let off = 0; SURAH_PAGES.forEach((s) => { OFFSET[s[0]] = off; off += s[3]; }); })();

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
 * - Asumsi menghafal berurutan dari An-Nas: surat terjauh yang disetor (nomor surat terkecil, nilai >= minimal)
 *   dianggap batas; semua surat dari An-Nas sampai batas itu dianggap hafal. Jika surat batas belum
 *   tercapai ayat terakhirnya, batas mundur satu surat (ayat parsialnya tetap dihitung di total ayat).
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

  // Isi otomatis: semua surat dari An-Nas sampai batas (surat terjauh yang disetor)
  const reached = Object.keys(covered).map(Number);
  if (reached.length) {
    const minNo = Math.min(...reached);
    const batas = covered[minNo].size >= AYAT[minNo] ? minNo : minNo + 1;
    for (let n = 114; n >= batas; n--) hafal.add(n);
  }

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

  // Halaman mushaf yang seluruh ayatnya sudah dihafal (poin prestasi dihitung dari sini)
  const hafalAyat = new Uint8Array(6237);
  for (let no = 1; no <= 114; no++) {
    if (hafal.has(no)) for (let a = 1; a <= AYAT[no]; a++) hafalAyat[OFFSET[no] + a] = 1;
    else if (covered[no]) covered[no].forEach((a) => { hafalAyat[OFFSET[no] + a] = 1; });
  }
  let halamanHafal = 0;
  for (let p = 0; p < 604; p++) {
    const from = PAGE_FIRST_AYAH_ID[p];
    const to = p + 1 < 604 ? PAGE_FIRST_AYAH_ID[p + 1] - 1 : 6236;
    let penuh = true;
    for (let i = from; i <= to; i++) if (!hafalAyat[i]) { penuh = false; break; }
    if (penuh) halamanHafal++;
  }

  return {
    halaman_hafal: halamanHafal,
    surat_hafal: hafal.size,
    total_ayat: totalAyat,
    berurutan,
    berurutan_label: berurutan ? `An-Nas → ${terakhirNama} (${berurutan} surat)` : '-',
    hafal_nos: Array.from(hafal).sort((x, y) => y - x),
  };
}
