'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { ASPEK_LIST, SKOR_LEVELS, DEFAULT_BOBOT, DEFAULT_POIN_PER_HALAMAN } from '@/lib/helpers';

export default function PengaturanView() {
  const [bobot, setBobot] = useState<Record<string, string>>({});
  const [poin, setPoin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/pengaturan')
      .then((r) => {
        const b: Record<string, string> = {};
        ASPEK_LIST.forEach((a) => { b[a.key] = String(r.bobot[a.key]); });
        setBobot(b);
        setPoin(String(r.poin_per_halaman));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = ASPEK_LIST.reduce((s, a) => s + (Number(bobot[a.key]) || 0), 0);
  const totalOk = Math.round(total * 100) / 100 === 100;

  async function simpan() {
    setError('');
    try {
      await api.put('/pengaturan', { bobot, poin_per_halaman: Number(poin) });
      showToast('Pengaturan berhasil disimpan');
    } catch (e: any) { setError(e.message); }
  }

  function reset() {
    const b: Record<string, string> = {};
    ASPEK_LIST.forEach((a) => { b[a.key] = String(DEFAULT_BOBOT[a.key]); });
    setBobot(b);
    setPoin(String(DEFAULT_POIN_PER_HALAMAN));
  }

  return (
    <div>
      <h1 className="tf-title">Pengaturan Penilaian</h1>
      {error && <div className="tf-error">{error}</div>}
      {loading ? <div className="tf-empty">Memuat...</div> : (
        <>
          <div className="tf-panel">
            <div className="tf-panel-head">Bobot Aspek Penilaian (Hafalan Baru &amp; Murojaah)</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Nilai akhir = jumlah (skor aspek × bobot). Skor tiap aspek: {SKOR_LEVELS.map((l) => `${l.label} ${l.skor}`).join(', ')}.
                Perubahan bobot berlaku untuk setoran <b>baru</b> dan setoran yang diedit; nilai lama tidak berubah otomatis.
              </p>
              {ASPEK_LIST.map((a) => (
                <div className="tf-field" key={a.key}>
                  <label>{a.label} (%)</label>
                  <input type="number" min={0} max={100} value={bobot[a.key] ?? ''} onChange={(e) => setBobot({ ...bobot, [a.key]: e.target.value })} />
                </div>
              ))}
              <div className="tf-empty" style={{ textAlign: 'left', color: totalOk ? undefined : '#dc2626', fontWeight: 700 }}>
                Total bobot: {total}% {totalOk ? '✓' : '(harus 100%)'}
              </div>
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Poin Prestasi Hafalan</div>
            <div className="tf-panel-body">
              <div className="tf-field">
                <label>Poin untuk setiap 1 halaman mushaf yang sudah dihafal</label>
                <input type="number" min={0} step="0.5" value={poin} onChange={(e) => setPoin(e.target.value)} />
              </div>
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Halaman dihitung bila seluruh ayat di halaman itu sudah dihafal (Hafalan Baru nilai ≥ 75, berurutan dari An-Nas). Halaman yang baru sebagian tidak diberi poin.
              </p>
            </div>
          </div>

          <button className="tf-btn" onClick={simpan} disabled={!totalOk}>Simpan Pengaturan</button>{' '}
          <button className="tf-btn tf-btn-secondary" onClick={reset}>Kembalikan Default</button>
        </>
      )}
    </div>
  );
}
