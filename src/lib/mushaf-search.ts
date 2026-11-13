// Pencarian terpadu Mushaf Digital: nomor ayat, nama surah (Latin), juz/halaman, alias, dan kata Arab.
import { SURAH_PAGES } from './surah-pages';

type Seg = [number, number, string];
type Item = ['h', number] | ['b'] | ['l', number, Seg[]];
export type SearchData = { juzStart: number[]; pages: Item[][] };

export type Hasil = {
  id: string;
  kind: 'ayat' | 'surah' | 'halaman' | 'juz' | 'teks';
  label: string;       // judul hasil
  sub?: string;        // keterangan kecil
  page: number;
  s?: number;
  a?: number;
  arab?: { before: string; hit: string; after: string }; // potongan ayat untuk kata Arab
};

// ------------------------------------------------------------ Arab
const isMark = (c: number) =>
  (c >= 0x0610 && c <= 0x061a) || (c >= 0x064b && c <= 0x065f) || c === 0x0670 ||
  (c >= 0x06d6 && c <= 0x06ed) || c === 0x0640 || (c >= 0x08d3 && c <= 0x08ff) || c === 0x200c || c === 0x200d;
const isArabLetter = (c: number) => (c >= 0x0621 && c <= 0x064a) || (c >= 0x066e && c <= 0x06d3) || c === 0x06ff;

const FOLD: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا',
  'ى': 'ي', 'ی': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ک': 'ك', 'ۀ': 'ه', 'ہ': 'ه', 'ھ': 'ه',
};

/** Normalisasi teks Arab: tanpa harakat, alif dihilangkan (ejaan Utsmani vs imla'i), ة=ه, ى=ي. map[i] = indeks asal untuk n[i]. */
export function normArab(text: string, popWaw = false): { n: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastLetterIdx = -1; // posisi di out dari huruf terakhir yang dimasukkan (untuk aturan وٰ)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const c = ch.charCodeAt(0);
    if (c === 0x0670) { // alif kecil: "وٰ" (mis. ٱلصَّلَوٰةَ) dibaca "ا" -> huruf و sebelumnya dibuang (alif ikut dibuang)
      if (popWaw && lastLetterIdx >= 0 && out[lastLetterIdx] === 'و' && lastLetterIdx === out.length - 1) { out.pop(); map.pop(); lastLetterIdx = -1; }
      continue;
    }
    if (isMark(c)) continue;
    if (ch === ' ' || ch === ' ') {
      if (out.length && out[out.length - 1] !== ' ') { out.push(' '); map.push(i); }
      continue;
    }
    if (!isArabLetter(c) && !FOLD[ch]) continue;
    const f = FOLD[ch] ?? ch;
    if (f === 'ا' || f === 'ء') continue; // alif & hamzah dibuang
    out.push(f); map.push(i);
    lastLetterIdx = out.length - 1;
  }
  while (out.length && out[out.length - 1] === ' ') { out.pop(); map.pop(); }
  return { n: out.join(''), map };
}

export const adaArab = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

// ------------------------------------------------------------ indeks ayat (dibuat sekali)
export type AyatIdx = { s: number; a: number; page: number; orig: string; n: string; map: number[]; n2: string; map2: number[] };
export type Index = { ayat: AyatIdx[]; data: SearchData };

export function buildIndex(data: SearchData): Index {
  const m = new Map<number, AyatIdx>();
  const order: AyatIdx[] = [];
  data.pages.forEach((items, pi) => {
    items.forEach((it) => {
      if (it[0] !== 'l') return;
      it[2].forEach(([s, a, t]) => {
        if (!s) return;
        const k = s * 1000 + a;
        let e = m.get(k);
        if (!e) { e = { s, a, page: pi + 1, orig: '', n: '', map: [], n2: '', map2: [] }; m.set(k, e); order.push(e); }
        e.orig += (e.orig ? ' ' : '') + t;
      });
    });
  });
  for (const e of order) { const r = normArab(e.orig); e.n = r.n; e.map = r.map; const r2 = normArab(e.orig, true); e.n2 = r2.n; e.map2 = r2.map; }
  return { ayat: order, data };
}

// ------------------------------------------------------------ Latin
/** Penyederhanaan ejaan agar "yaasiin", "Ya-Sin", "kahfi", "al kahf" mudah cocok. */
export function foldLatin(s: string): string {
  let t = s.toLowerCase().replace(/[’`´ʿʾ]/g, "'");
  t = t.replace(/[^a-z0-9']+/g, ' ').replace(/'/g, '');
  t = t.replace(/\s+/g, '');
  t = t.replace(/(ou|oo)/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a').replace(/ii/g, 'i').replace(/uu/g, 'u');
  t = t.replace(/(sh|ts)/g, 's').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/dh/g, 'd').replace(/th/g, 't').replace(/zh/g, 'z');
  t = t.replace(/q/g, 'k').replace(/z/g, 's').replace(/y(?=[aiu])/g, 'y').replace(/ph/g, 'f').replace(/v/g, 'f');
  t = t.replace(/(.)\1+/g, '$1'); // huruf ganda (Tt, ss, mm) jadi satu
  return t;
}

const ARTIKEL = /^(al|an|ar|as|ash|at|ath|ats|ad|adh|az|azh)(?=[a-z])/;
type NamaIdx = { no: number; nama: string; full: string; polos: string; page: number; jml: number };
let namaCache: NamaIdx[] | null = null;
function namaIdx(): NamaIdx[] {
  if (!namaCache) {
    namaCache = SURAH_PAGES.map(([no, nama, page, jml]) => {
      const raw = nama.toLowerCase().replace(/[^a-z']+/g, '');
      const polos0 = raw.replace(ARTIKEL, '');
      return { no, nama, full: foldLatin(raw), polos: foldLatin(polos0), page, jml };
    });
  }
  return namaCache;
}

// nama populer / alias (kunci sudah dalam bentuk foldLatin)
const ALIAS_SURAH: Record<string, number> = {
  [foldLatin('yasin')]: 36, [foldLatin('yaasin')]: 36, [foldLatin('alkahfi')]: 18, [foldLatin('kahfi')]: 18,
  [foldLatin('rahman')]: 55, [foldLatin('arrahman')]: 55, [foldLatin('mulk')]: 67, [foldLatin('tabarok')]: 67, [foldLatin('tabarak')]: 67,
  [foldLatin('waqiah')]: 56, [foldLatin('sajadah')]: 32, [foldLatin('sajdah')]: 32, [foldLatin('insyirah')]: 94, [foldLatin('alamnasyroh')]: 94,
  [foldLatin('syarh')]: 94, [foldLatin('asyams')]: 91, [foldLatin('syams')]: 91, [foldLatin('dhuha')]: 93, [foldLatin('duha')]: 93,
  [foldLatin('ikhlas')]: 112, [foldLatin('falaq')]: 113, [foldLatin('nas')]: 114, [foldLatin('naas')]: 114, [foldLatin('maun')]: 107,
  [foldLatin('kafirun')]: 109, [foldLatin('kautsar')]: 108, [foldLatin('kausar')]: 108, [foldLatin('kawtsar')]: 108,
  [foldLatin('nisa')]: 4, [foldLatin('imran')]: 3, [foldLatin('ali imran')]: 3, [foldLatin('taha')]: 20, [foldLatin('thaha')]: 20,
  [foldLatin('yusuf')]: 12, [foldLatin('yunus')]: 10, [foldLatin('luqman')]: 31, [foldLatin('lukman')]: 31,
  [foldLatin('muzammil')]: 73, [foldLatin('mudatsir')]: 74, [foldLatin('mudassir')]: 74, [foldLatin('naba')]: 78, [foldLatin('amma')]: 78,
};

const SURAH_PHRASE: Record<string, [number, number, string]> = {
  'ayatkursi': [2, 255, 'Ayat Kursi'], 'ayatulkursi': [2, 255, 'Ayat Kursi'], 'kursi': [2, 255, 'Ayat Kursi'],
};

function cocokSurah(q: string): NamaIdx[] {
  const f = foldLatin(q.replace(/^\s*(surah|surat|sura|qs\.?)\s+/i, ''));
  if (!f) return [];
  const f2 = f.replace(ARTIKEL, '');
  const skor: [number, NamaIdx][] = [];
  const alias = ALIAS_SURAH[f] ?? ALIAS_SURAH[f2];
  for (const n of namaIdx()) {
    let sk = 99;
    if (alias === n.no) sk = 0;
    else if (n.polos === f2 || n.full === f) sk = 1;
    else if (n.polos.startsWith(f2) || n.full.startsWith(f)) sk = 2;
    else if (f2.length >= 3 && n.polos.includes(f2)) sk = 3;
    else if (n.polos.length >= 4 && f2.length > n.polos.length && f2.startsWith(n.polos)) sk = 4; // "kahfi" ⊃ "kahf"
    if (sk < 99) skor.push([sk, n]);
  }
  skor.sort((x, y) => x[0] - y[0] || x[1].no - y[1].no);
  return skor.map((x) => x[1]);
}

// ------------------------------------------------------------ pencarian utama
export const MAKS_TEKS = 400; // batas pengaman jumlah hasil kata Arab yang dikumpulkan

export type Keluaran = { hasil: Hasil[]; total: number; pesan?: string };

function hasilAyat(idx: Index, s: number, a: number, labelNama?: string): Hasil | null {
  const e = idx.ayat.find((x) => x.s === s && x.a === a);
  if (!e) return null;
  return { id: `a${s}:${a}`, kind: 'ayat', label: `${labelNama ?? SURAH_PAGES[s - 1][1]} : ${a}`, sub: `hal. ${e.page}`, page: e.page, s, a };
}

export function cari(idx: Index, qRaw: string): Keluaran {
  const q = qRaw.trim();
  if (!q) return { hasil: [], total: 0 };

  // --- kata/kalimat Arab
  if (adaArab(q)) {
    const nq = normArab(q).n;
    if (nq.replace(/ /g, '').length < 2) return { hasil: [], total: 0, pesan: 'Ketik minimal 2 huruf Arab' };
    const hasil: Hasil[] = [];
    let total = 0;
    for (const e of idx.ayat) {
      let n = e.n, mp = e.map, p = n.indexOf(nq);
      if (p < 0) { n = e.n2; mp = e.map2; p = n.indexOf(nq); }
      if (p < 0) continue;
      total++;
      if (hasil.length >= MAKS_TEKS) continue;
      let a0 = mp[p];
      while (a0 > 0 && e.orig[a0 - 1] !== ' ') a0--; // sorot seluruh kata
      const a1 = mp[Math.min(p + nq.length - 1, mp.length - 1)] + 1;
      // sertakan harakat yang menempel pada huruf terakhir
      let end = a1;
      while (end < e.orig.length && e.orig[end] !== ' ') end++;
      const kiri = Math.max(0, a0 - 45), kanan = Math.min(e.orig.length, end + 60);
      hasil.push({
        id: `t${e.s}:${e.a}`, kind: 'teks', label: `${SURAH_PAGES[e.s - 1][1]} : ${e.a}`, sub: `hal. ${e.page}`, page: e.page, s: e.s, a: e.a,
        arab: { before: (kiri > 0 ? '… ' : '') + e.orig.slice(kiri, a0), hit: e.orig.slice(a0, end), after: e.orig.slice(end, kanan) + (kanan < e.orig.length ? ' …' : '') },
      });
    }
    return { hasil, total, pesan: total === 0 ? 'Kata itu tidak ditemukan. Coba satu kata saja atau ejaan lain.' : undefined };
  }

  const ql = q.toLowerCase();

  // --- halaman: "h 582", "hal 582", "halaman 582"
  let m = ql.match(/^(?:h|hal|halaman|page|p)\.?\s*(\d{1,3})$/);
  if (m) {
    const p = Number(m[1]);
    if (p < 1 || p > 604) return { hasil: [], total: 0, pesan: 'Halaman 1–604' };
    return { hasil: [{ id: `h${p}`, kind: 'halaman', label: `Halaman ${p}`, page: p }], total: 1 };
  }
  // --- juz: "juz 29"
  m = ql.match(/^juz\s*'?(\d{1,2})$/);
  if (m) {
    const j = Number(m[1]);
    if (j < 1 || j > 30) return { hasil: [], total: 0, pesan: 'Juz 1–30' };
    return { hasil: [{ id: `j${j}`, kind: 'juz', label: `Juz ${j}`, sub: `hal. ${idx.data.juzStart[j - 1]}`, page: idx.data.juzStart[j - 1] }], total: 1 };
  }
  // --- angka: "2:255", "2 255", "2.255"
  m = ql.match(/^(\d{1,3})\s*[:.,\s-]\s*(\d{1,3})$/);
  if (m) {
    const s = Number(m[1]), a = Number(m[2]);
    if (s < 1 || s > 114) return { hasil: [], total: 0, pesan: 'Nomor surah 1–114' };
    if (a < 1 || a > SURAH_PAGES[s - 1][3]) return { hasil: [], total: 0, pesan: `${SURAH_PAGES[s - 1][1]} hanya ${SURAH_PAGES[s - 1][3]} ayat` };
    const h = hasilAyat(idx, s, a);
    return h ? { hasil: [h], total: 1 } : { hasil: [], total: 0, pesan: 'Ayat tidak ditemukan' };
  }
  // --- nomor surah saja: "36"
  m = ql.match(/^(\d{1,3})$/);
  if (m) {
    const s = Number(m[1]);
    if (s < 1 || s > 114) return { hasil: [], total: 0, pesan: 'Nomor surah 1–114' };
    const n = SURAH_PAGES[s - 1];
    return { hasil: [{ id: `s${s}`, kind: 'surah', label: `${s}. ${n[1]}`, sub: `${n[3]} ayat · hal. ${n[2]}`, page: n[2], s, a: 1 }], total: 1 };
  }
  // --- "3 qul"
  const kompak = foldLatin(ql);
  if (kompak === foldLatin('3 qul') || kompak === foldLatin('tiga qul') || kompak === foldLatin('3kul')) {
    return {
      hasil: [112, 113, 114].map((s) => ({ id: `s${s}`, kind: 'surah' as const, label: `${s}. ${SURAH_PAGES[s - 1][1]}`, sub: `hal. ${SURAH_PAGES[s - 1][2]}`, page: SURAH_PAGES[s - 1][2], s, a: 1 })),
      total: 3,
    };
  }
  // --- ayat kursi
  const fr = SURAH_PHRASE[kompak];
  if (fr) { const h = hasilAyat(idx, fr[0], fr[1], fr[2]); if (h) return { hasil: [h], total: 1 }; }

  // --- nama surah (+ nomor ayat opsional): "baqarah 255", "al-baqarah:255", "kahfi"
  let nama = q, ayat = 0;
  const mm = q.match(/^(.*?)[\s:.,-]*(\d{1,3})$/);
  if (mm && mm[1].trim()) { nama = mm[1].trim(); ayat = Number(mm[2]); }
  const cocok = cocokSurah(nama);
  if (!cocok.length) return { hasil: [], total: 0, pesan: 'Tidak ditemukan. Coba: 2:255, baqarah 255, kahfi, atau kata Arab.' };
  const hasil: Hasil[] = [];
  for (const n of cocok.slice(0, 8)) {
    if (ayat) {
      if (ayat > n.jml) { hasil.push({ id: `x${n.no}`, kind: 'surah', label: `${n.nama} hanya ${n.jml} ayat`, sub: 'buka awal surah', page: n.page, s: n.no, a: 1 }); continue; }
      const h = hasilAyat(idx, n.no, ayat);
      if (h) hasil.push(h);
    } else {
      hasil.push({ id: `s${n.no}`, kind: 'surah', label: `${n.no}. ${n.nama}`, sub: `${n.jml} ayat · hal. ${n.page}`, page: n.page, s: n.no, a: 1 });
    }
  }
  return { hasil, total: hasil.length };
}
