'use client';

import { useEffect, useState } from 'react';

export default function MushafView() {
  const [page, setPage] = useState(1);
  const [ayahs, setAyahs] = useState<any[]>([]);
  const [surahName, setSurahName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`)
      .then((r) => r.json())
      .then((json) => {
        if (json.code !== 200) throw new Error('Gagal memuat halaman mushaf');
        setAyahs(json.data.ayahs);
        setSurahName(json.data.ayahs?.[0]?.surah?.name || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 className="tf-title">Mushaf Digital</h1>
      <p className="tf-empty">Mushaf standar Madinah, 604 halaman — sumber: api.alquran.cloud</p>

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Halaman (1–604)</label>
            <input
              type="number" min={1} max={604} value={page}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= 604) setPage(v);
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tf-btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Sebelumnya</button>
            <button className="tf-btn-sm" onClick={() => setPage((p) => Math.min(604, p + 1))}>Berikutnya ›</button>
          </div>
        </div>
      </div>

      <div className="tf-panel">
        <div className="tf-panel-head">Halaman {page} {surahName && `— ${surahName}`}</div>
        <div className="tf-panel-body">
          {error && <div className="tf-error">{error}</div>}
          {loading ? <div className="tf-empty">Memuat ayat...</div> : (
            <p className="tf-mushaf-page" dir="rtl" lang="ar">
              {ayahs.map((a) => `${a.text} ﴿${a.numberInSurah}﴾ `)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
