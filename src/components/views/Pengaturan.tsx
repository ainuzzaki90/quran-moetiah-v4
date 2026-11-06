'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { ASPEK_LIST, SKOR_LEVELS, DEFAULT_BOBOT, DEFAULT_POIN_PER_HALAMAN, LEVEL_JILID_UMMI, DEFAULT_HALAMAN_JILID, DEFAULT_SYARAT_UJIAN } from '@/lib/helpers';

export default function PengaturanView() {
  const [bobot, setBobot] = useState<Record<string, string>>({});
  const [poin, setPoin] = useState('');
  const [halJilid, setHalJilid] = useState<Record<string, string>>({});
  const [syarat, setSyarat] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/pengaturan')
      .then((r) => {
        const b: Record<string, string> = {};
        ASPEK_LIST.forEach((a) => { b[a.key] = String(r.bobot[a.key]); });
        setBobot(b);
        setPoin(String(r.poin_per_halaman));
        const hj: Record<string, string> = {};
        LEVEL_JILID_UMMI.forEach((j) => { hj[j] = String(r.halaman_per_jilid?.[j] ?? DEFAULT_HALAMAN_JILID[j]); });
        setHalJilid(hj);
        setSyarat({
          rata_min: String(r.syarat_ujian?.rata_min ?? DEFAULT_SYARAT_UJIAN.rata_min),
          jumlah_setoran: String(r.syarat_ujian?.jumlah_setoran ?? DEFAULT_SYARAT_UJIAN.jumlah_setoran),
          nilai_halaman_akhir: String(r.syarat_ujian?.nilai_halaman_akhir ?? DEFAULT_SYARAT_UJIAN.nilai_halaman_akhir),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = ASPEK_LIST.reduce((s, a) => s + (Number(bobot[a.key]) || 0), 0);
  const totalOk = Math.round(total * 100) / 100 === 100;

  async function simpan() {
    setError('');
    try {
      await api.put('/pengaturan', { bobot, poin_per_halaman: Number(poin), halaman_per_jilid: halJilid, syarat_ujian: syarat });
      showToast('Pengaturan berhasil disimpan');
    } catch (e: any) { setError(e.message); }
  }

  function reset() {
    const b: Record<string, string> = {};
    ASPEK_LIST.forEach((a) => { b[a.key] = String(DEFAULT_BOBOT[a.key]); });
    setBobot(b);
    setPoin(String(DEFAULT_POIN_PER_HALAMAN));
    const hj: Record<string, string> = {};
    LEVEL_JILID_UMMI.forEach((j) => { hj[j] = String(DEFAULT_HALAMAN_JILID[j]); });
    setHalJilid(hj);
    setSyarat({
      rata_min: String(DEFAULT_SYARAT_UJIAN.rata_min), jumlah_setoran: String(DEFAULT_SYARAT_UJIAN.jumlah_setoran),
      nilai_halaman_akhir: String(DEFAULT_SYARAT_UJIAN.nilai_halaman_akhir),
    });
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

          <div className="tf-panel">
            <div className="tf-panel-head">Kenaikan Jilid Ummi</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Jumlah halaman tiap jilid. Siswa dianggap <b>siap ujian kenaikan jilid</b> bila sudah mencapai halaman terakhir jilidnya
                dan memenuhi syarat nilai di bawah. Sesuaikan dengan buku Ummi yang dipakai sekolah.
              </p>
              {LEVEL_JILID_UMMI.map((j) => (
                <div className="tf-field" key={j}>
                  <label>Jumlah halaman {j}</label>
                  <input type="number" min={1} max={500} value={halJilid[j] ?? ''} onChange={(e) => setHalJilid({ ...halJilid, [j]: e.target.value })} />
                </div>
              ))}
              <div className="tf-field">
                <label>Nilai minimal di halaman terakhir jilid</label>
                <input type="number" min={0} max={100} value={syarat.nilai_halaman_akhir ?? ''} onChange={(e) => setSyarat({ ...syarat, nilai_halaman_akhir: e.target.value })} />
              </div>
              <div className="tf-field">
                <label>Rata-rata nilai minimal</label>
                <input type="number" min={0} max={100} value={syarat.rata_min ?? ''} onChange={(e) => setSyarat({ ...syarat, rata_min: e.target.value })} />
              </div>
              <div className="tf-field">
                <label>…dihitung dari berapa setoran Ummi terakhir</label>
                <input type="number" min={1} value={syarat.jumlah_setoran ?? ''} onChange={(e) => setSyarat({ ...syarat, jumlah_setoran: e.target.value })} />
              </div>
            </div>
          </div>

          <button className="tf-btn" onClick={simpan} disabled={!totalOk}>Simpan Pengaturan</button>{' '}
          <button className="tf-btn tf-btn-secondary" onClick={reset}>Kembalikan Default</button>
        </>
      )}
    </div>
  );
}
