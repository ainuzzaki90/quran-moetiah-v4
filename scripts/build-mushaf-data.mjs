// Membuat public/mushaf/mushaf-data.json dari dataset @quran.ws/text (Hafs, tata letak 15 baris KFGQPC).
// Jalankan ulang hanya bila dataset diperbarui:  node scripts/build-mushaf-data.mjs
// Teks & font: KFGQPC Uthmanic Hafs via quran-text (lisensi CC-BY-4.0, https://quran.ws).
import { Mushaf, ayahMark } from '@quran.ws/text';
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_FIRST_AYAH_ID } from './page-first-ayah.mjs';

const m = await Mushaf.hafs();
const BASM = m.ayah(1, 1).text.trim();
// posisi kata terakhir tiap ayat (a.end adalah batas span, bukan kata terakhir)
const lastPos = new Map();
for (const a of m.ayahs) lastPos.set(`${a.surah.number}:${a.number}`, a.wordList[a.wordList.length - 1].position);
const isAyahEnd = (w) => w.ayah && lastPos.get(`${w.ayah.surah.number}:${w.ayah.number}`) === w.position;
const pages = [];
const juzStart = [];
let mismatch = 0, renderMismatch = 0;

for (let p = 1; p <= 604; p++) {
  const pg = m.page(p);
  const items = [];
  for (const line of pg.lines) {
    for (const s of m.surahs) {
      const w0 = s.ayahs[0].wordList[0];
      if (w0.page.number === p && w0.line && w0.line.number === line.number) {
        items.push(['h', s.number]);
        if (s.number !== 1 && s.number !== 9) items.push(['b']);
      }
    }
    // pecah baris menjadi segmen per ayat: [surah, ayat, teks]; penanda akhir ayat ikut ke segmen ayatnya
    const segs = [];
    for (const w of line.wordList) {
      const a = w.ayah;
      const key = a ? [a.surah.number, a.number] : [0, 0];
      let t = w.render(true);
      if (isAyahEnd(w)) t += ' ' + ayahMark(a.number);
      const last = segs[segs.length - 1];
      if (last && last[0] === key[0] && last[1] === key[1]) last[2] += ' ' + t;
      else segs.push([key[0], key[1], t]);
    }
    // verifikasi: gabungan segmen harus sama persis dengan render bawaan dataset
    const joined = segs.map((x) => x[2]).join(' ');
    if (joined !== line.render({ marks: true, ayahMarks: true })) renderMismatch++;
    const lw = line.wordList[line.wordList.length - 1];
    const a = lw.ayah;
    const endsSurah = isAyahEnd(lw) && a.number === a.surah.ayahCount ? 1 : 0;
    items.push(['l', endsSurah, segs]);
  }
  // halaman harus 15 baris (8 untuk hal. 1-2)
  if (items.length !== (p <= 2 ? 8 : 15)) { console.error('Jumlah baris tidak sesuai di halaman', p, items.length); process.exit(1); }
  // ayat pertama halaman harus sama dengan tabel PAGE_FIRST_AYAH_ID (dipakai poin/peta hafalan)
  const firstAyah = pg.firstAyah;
  const globalId = (s, a) => { let n = 0; for (let i = 1; i < s; i++) n += m.surah(i).ayahCount; return n + a; };
  if (globalId(firstAyah.surah.number, firstAyah.number) !== PAGE_FIRST_AYAH_ID[p - 1]) mismatch++; // diketahui: 25 halaman (lihat catatan di README)
  pages.push(items);
}
for (let j = 1; j <= 30; j++) juzStart.push(m.juz(j).page.number);

const out = {
  basmalah: BASM,
  surahNameAr: m.surahs.map((s) => s.nameAr),
  juzStart,
  pages,
};
fs.mkdirSync('public/mushaf', { recursive: true });
fs.writeFileSync('public/mushaf/mushaf-data.json', JSON.stringify(out));
fs.copyFileSync(path.join('node_modules', '@quran.ws', 'text', 'data', 'UthmanicHafs-v-3.0.ttf'), 'public/mushaf/UthmanicHafs-v-3.0.ttf');
console.log('OK. halaman:', pages.length, '| render beda:', renderMismatch, '| halaman yang awalnya beda dari tabel poin:', mismatch, '| juz:', juzStart.join(','));
