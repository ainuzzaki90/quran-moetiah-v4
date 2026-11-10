// Membuat ulang src/lib/mushaf-pages.ts dari public/mushaf/mushaf-data.json
// Pakai: node scripts/page-first-ayah.mjs
import fs from 'fs';
const d = JSON.parse(fs.readFileSync('public/mushaf/mushaf-data.json', 'utf8'));
const sp = [...fs.readFileSync('src/lib/surah-pages.ts', 'utf8').matchAll(/\[(\d+),"([^"]+)",(\d+),(\d+)\]/g)].map((m) => +m[4]);
const cum = [0]; sp.forEach((n) => cum.push(cum[cum.length - 1] + n));
const first = new Map();
d.pages.forEach((items, i) => items.forEach((it) => { if (it[0] === 'l') it[2].forEach(([s, a]) => { const g = cum[s - 1] + a; if (s && !first.has(g)) first.set(g, i + 1); }); }));
const pf = new Array(604).fill(Infinity);
for (const [g, p] of first) if (g < pf[p - 1]) pf[p - 1] = g;
if (pf.some((v) => v === Infinity) || first.size !== 6236) throw new Error('data tidak lengkap');
const rows = []; for (let i = 0; i < 604; i += 20) rows.push('  ' + pf.slice(i, i + 20).join(',') + ',');
fs.writeFileSync('src/lib/mushaf-pages.ts', `// Ayat pertama (nomor ayat global 1..6236) di tiap halaman mushaf Madinah (604 halaman).
// Sumber: dataset mushaf yang sama dengan tampilan Mushaf Digital (public/mushaf/mushaf-data.json),
// dikonfirmasi cocok dengan mushaf cetak pada halaman 597 (mulai Al-Insyirah 94:3).
// Ayat yang berlanjut dari halaman sebelumnya dihitung milik halaman tempat ayat itu dimulai. Indeks 0 = halaman 1.
// Dibuat ulang dengan: node scripts/page-first-ayah.mjs
export const PAGE_FIRST_AYAH_ID: number[] = [
${rows.join('\n')}
];
`);
console.log('ok');
