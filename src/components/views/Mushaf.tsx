'use client';

import { useEffect, useRef, useState } from 'react';
import { SURAH_PAGES } from '@/lib/surah-pages';

function toArabicNumber(n: number): string {
  const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).split('').map((d) => ar[Number(d)]).join('');
}

export default function MushafView() {
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [html, setHtml] = useState('Memuat...');
  const [loading, setLoading] = useState(true);
  const basmalahRef = useRef<string | null>(null);

  async function getBasmalahText(): Promise<string | null> {
    if (basmalahRef.current) return basmalahRef.current;
    try {
      const res = await fetch('https://api.alquran.cloud/v1/ayah/1/quran-uthmani');
      const json = await res.json();
      if (json.code === 200 && json.data?.text) basmalahRef.current = json.data.text.trim();
    } catch { /* abaikan, fallback tanpa pemisahan */ }
    return basmalahRef.current;
  }

  async function loadPage(p: number) {
    setLoading(true);
    setHtml(`Memuat halaman ${p}...`);
    try {
      const basmalahText = await getBasmalahText();
      const res = await fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`);
      const json = await res.json();
      if (json.code !== 200) { setHtml('Gagal memuat halaman.'); setLoading(false); return; }
      const ayahs = json.data.ayahs;
      let out = '';
      let lastSurah: number | null = null;
      ayahs.forEach((a: any) => {
        if (a.surah.number !== lastSurah) {
          out += `<div class="tf-surah-head">سورة ${a.surah.name}</div>`;
          lastSurah = a.surah.number;
        }
        let ayahText = a.text;
        if (a.numberInSurah === 1 && a.surah.number !== 1 && a.surah.number !== 9 && basmalahText && ayahText.indexOf(basmalahText) === 0) {
          out += `<div class="tf-basmalah">${basmalahText}</div><div class="tf-basmalah-divider"></div>`;
          ayahText = ayahText.slice(basmalahText.length).trim();
        }
        out += `<span class="tf-ayah">${ayahText}<span class="tf-ayah-num">﴿${toArabicNumber(a.numberInSurah)}﴾</span></span> `;
      });
      setHtml(out);
      setPage(p);
      setPageInput(String(p));
    } catch {
      setHtml('Gagal memuat halaman (periksa koneksi internet).');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPage(1); }, []);

  function goto() {
    const p = Number(pageInput);
    if (p >= 1 && p <= 604) loadPage(p);
  }

  return (
    <div>
      <h1 className="tf-title">Mushaf Digital</h1>
      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-mushaf-toolbar">
            <select onChange={(e) => loadPage(Number(e.target.value))} value="">
              <option value="" disabled>-- Lompat ke surah --</option>
              {SURAH_PAGES.map((s) => <option key={s[0]} value={s[2]}>{s[0]}. {s[1]}</option>)}
            </select>
            <button className="tf-btn-sm" onClick={() => page > 1 && loadPage(page - 1)}>‹ Sebelumnya</button>
            <span>
              Hal. <input type="number" min={1} max={604} value={pageInput} onChange={(e) => setPageInput(e.target.value)} /> / 604
            </span>
            <button className="tf-btn-sm" onClick={goto}>Buka</button>
            <button className="tf-btn-sm" onClick={() => page < 604 && loadPage(page + 1)}>Berikutnya ›</button>
          </div>
          <div className="tf-mushaf-page" dir="rtl" lang="ar" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="tf-mushaf-note">Penomoran halaman mengikuti Mushaf Madinah standar (604 halaman); mungkin berbeda 1-2 halaman dari beberapa cetakan.</div>
        </div>
      </div>
    </div>
  );
}
