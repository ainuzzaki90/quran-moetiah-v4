// ============================================================
//  Helpers.ts — port 1:1 dari backend Apps Script lama (Helpers.gs)
//  Predikat nilai, posisi/capaian terakhir hafalan, tahun ajaran,
//  rentang tanggal per periode, dan rubrik penilaian metode Ummi.
// ============================================================

export type SetoranRow = {
  id?: number;
  tanggal: string;
  santri_id: number;
  jenis: 'Setoran Metode Ummi' | 'Hafalan Baru' | 'Murojaah' | 'Tilawah';
  surah?: string | null;
  ayat_mulai?: string | null;
  surah_selesai?: string | null;
  ayat_selesai?: string | null;
  halaman_mulai?: string | null;
  halaman_selesai?: string | null;
  nilai?: number | null;
  predikat?: string | null;
  [key: string]: any;
};

// ============== LEVEL JILID UMMI ==============
// Disalin persis dari script.js versi lama.
export const LEVEL_JILID_UMMI = ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6'];
export const LEVEL_UMMI_OPTIONS = [...LEVEL_JILID_UMMI, 'Gharib/Tajwid', "Al-Qur'an"];
export const MAX_HALAMAN_UMMI = 50; // Maksimal halaman buku Jilid Ummi 1-6

// ============== PREDIKAT (skala umum tahfiz/Ummi) ==============
export function calcPredikat(nilai: number | null | undefined): string {
  const n = Number(nilai);
  if (isNaN(n)) return '';
  if (n >= 95) return 'Mumtaz';
  if (n >= 85) return 'Jayyid Jiddan';
  if (n >= 75) return 'Jayyid';
  if (n >= 60) return 'Maqbul';
  return 'Dhoif';
}

// ============== RUBRIK PENILAIAN METODE UMMI ==============
// Dipakai di form input Setoran Metode Ummi untuk memandu penyimak memilih
// nilai berdasarkan jumlah kesalahan bacaan santri, persis tabel di versi lama.
export const UMMI_RUBRIK = [
  { kode: 'Aplus',  label: 'A+ (benar semua, bacaan bagus sekali)',        kesalahan: 0, nilai: 100, status: 'Naik ke halaman berikutnya',        keterangan: 'Benar semua dan kualitas bacaan bagus sekali.' },
  { kode: 'A',      label: 'A (benar semua, bacaan biasa-biasa)',          kesalahan: 0, nilai: 90,  status: 'Naik ke halaman berikutnya',        keterangan: 'Benar semua dan kualitas bacaan biasa-biasa.' },
  { kode: 'Bplus',  label: 'B+ (salah 1x, bisa membetulkan sendiri)',      kesalahan: 1, nilai: 85,  status: 'Naik ke halaman berikutnya',        keterangan: 'Salah satu kali dan bisa membetulkan sendiri.' },
  { kode: 'B',      label: 'B (salah 2x, bisa membetulkan sendiri)',       kesalahan: 2, nilai: 80,  status: 'Naik ke halaman berikutnya',        keterangan: 'Salah dua kali dan bisa membetulkan sendiri.' },
  { kode: 'Bminus', label: 'B- (salah 3x, bisa membetulkan sendiri)',      kesalahan: 3, nilai: 75,  status: 'Naik, tapi diulangi dulu halaman tsb', keterangan: 'Salah tiga kali dan bisa membetulkan sendiri.' },
  { kode: 'Cplus',  label: 'C+ (salah 4x, bisa membetulkan sendiri)',      kesalahan: 4, nilai: 70,  status: 'Belum boleh dinaikkan/diulang lagi', keterangan: 'Salah empat kali dan bisa membetulkan sendiri.' },
  { kode: 'C',      label: 'C (salah 5x, bisa membetulkan sendiri)',       kesalahan: 5, nilai: 65,  status: 'Belum boleh dinaikkan/diulang lagi', keterangan: 'Salah lima kali dan bisa membetulkan sendiri.' },
  { kode: 'Cminus', label: 'C- (salah 6x, bisa membetulkan sendiri)',      kesalahan: 6, nilai: 60,  status: 'Belum boleh dinaikkan/diulang lagi', keterangan: 'Salah enam kali dan bisa membetulkan sendiri.' },
  { kode: 'D',      label: 'D (salah >6x atau tidak bisa membetulkan sendiri)', kesalahan: 7, nilai: 50, status: 'Belum boleh dinaikkan/diulang lagi', keterangan: 'Salah satu kali namun tidak bisa membetulkan sendiri/tetap salah dalam membaca, maka belum bisa dinaikkan.' },
];

// ============== POSISI / CAPAIAN TERAKHIR ==============
// Hanya jenis 'Setoran Metode Ummi' (per halaman, untuk level Jilid) dan
// 'Hafalan Baru' (per surah/ayat, untuk yang sudah masuk Al-Qur'an) yang
// dianggap penanda posisi maju -- Murojaah & Tilawah adalah pengulangan
// materi lama, bukan capaian baru.
export function computeCapaianTerakhir(rowsSantri: SetoranRow[]) {
  const ummiRows = rowsSantri
    .filter((r) => r.jenis === 'Setoran Metode Ummi')
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  const hafalanRows = rowsSantri
    .filter((r) => r.jenis === 'Hafalan Baru')
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const halaman = ummiRows.length
    ? {
        label: 'Halaman ' + (ummiRows[0].halaman_selesai || ummiRows[0].halaman_mulai || '-'),
        tanggal: ummiRows[0].tanggal,
      }
    : null;

  const surah = hafalanRows.length
    ? {
        label:
          (hafalanRows[0].surah_selesai || hafalanRows[0].surah || '-') +
          ' : Ayat ' +
          (hafalanRows[0].ayat_selesai || hafalanRows[0].ayat_mulai || '-'),
        tanggal: hafalanRows[0].tanggal,
      }
    : null;

  return { halaman, surah };
}

// ============== TANGGAL / PERIODE ==============
export function computeDateRange(payload: {
  periode?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  tanggal_referensi?: string;
}) {
  if (payload.periode === 'tentatif' && payload.tanggal_mulai && payload.tanggal_selesai) {
    const start = new Date(payload.tanggal_mulai);
    const end = new Date(payload.tanggal_selesai + 'T23:59:59');
    return { start, end };
  }
  const ref = payload.tanggal_referensi ? new Date(payload.tanggal_referensi) : new Date();

  if (payload.periode === 'harian') {
    const start = new Date(ref); start.setHours(0, 0, 0, 0);
    const end = new Date(ref); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (payload.periode === 'pekanan') {
    const start = new Date(ref);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // default: bulanan
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function normalizeTanggal(v: string | null | undefined): string {
  if (!v) return '';
  try {
    return new Date(v).toISOString().substring(0, 10);
  } catch {
    return String(v).substring(0, 10);
  }
}

/**
 * Tahun ajaran Indonesia: Juli - Juni.
 *   - Bulan 7-12 -> "YYYY/YYYY+1" (Semester Ganjil)
 *   - Bulan 1-6  -> "YYYY-1/YYYY" (Semester Genap)
 * Contoh: Juli 2026 -> "2026/2027" | Maret 2027 -> "2026/2027"
 */
export function getTahunAjaran(refDate?: Date) {
  const d = refDate || new Date();
  const thn = d.getFullYear();
  const bln = d.getMonth() + 1;
  if (bln >= 7) return { tahun_ajaran: `${thn}/${thn + 1}`, semester: 1 };
  return { tahun_ajaran: `${thn - 1}/${thn}`, semester: 2 };
}
