'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

const STATUS_OPTIONS = [
  { key: 'Hadir', color: 'var(--green)' },
  { key: 'Izin', color: '#0284c7' },
  { key: 'Sakit', color: '#d97706' },
  { key: 'Alfa', color: '#dc2626' },
];

function todayStr() {
  return new Date().toISOString().substring(0, 10);
}

export default function PresensiView({ user }: { user: User }) {
  const [tab, setTab] = useState<'input' | 'rekap'>('input');
  const [santriList, setSantriList] = useState<any[]>([]);
  const [tanggal, setTanggal] = useState(todayStr());
  const [materi, setMateri] = useState('');
  const [status, setStatus] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [riwayat, setRiwayat] = useState<any[]>([]);

  const [rekap, setRekap] = useState<any[]>([]);
  const [rekapLoading, setRekapLoading] = useState(false);
  const [rekapMulai, setRekapMulai] = useState('');
  const [rekapAkhir, setRekapAkhir] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/santri?binaan_only=1'),
      api.get('/presensi'),
    ])
      .then(([s, p]) => {
        setSantriList(s.data);
        const initial: Record<number, string> = {};
        s.data.forEach((x: any) => { initial[x.id] = 'Hadir'; });
        setStatus(initial);
        setRiwayat(p.data.slice(0, 30));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function loadRekap() {
    setRekapLoading(true);
    const qs = new URLSearchParams();
    if (rekapMulai) qs.set('tanggal_mulai', rekapMulai);
    if (rekapAkhir) qs.set('tanggal_akhir', rekapAkhir);
    api.get(`/presensi/rekap?${qs.toString()}`)
      .then((res) => setRekap(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setRekapLoading(false));
  }
  useEffect(() => { if (tab === 'rekap') loadRekap(); }, [tab]);

  async function simpan() {
    setError(''); setOk('');
    if (!santriList.length) { setError('Belum ada siswa binaan untuk dipresensi'); return; }
    try {
      const rows = santriList.map((s) => ({ santri_id: s.id, kelas_id: s.kelas_id, status: status[s.id] || 'Hadir' }));
      await api.post('/presensi', { tanggal, materi, rows });
      setOk('Presensi berhasil disimpan.');
      load();
    } catch (e: any) { setError(e.message); }
  }

  function setAllStatus(st: string) {
    const next: Record<number, string> = {};
    santriList.forEach((s) => { next[s.id] = st; });
    setStatus(next);
  }

  return (
    <div>
      <h1 className="tf-title">Presensi</h1>
      {error && <div className="tf-error">{error}</div>}
      {ok && <div className="tf-empty">{ok}</div>}

      <div className="tf-tabs">
        <button className={`tf-tab ${tab === 'input' ? 'active' : ''}`} onClick={() => setTab('input')}>📝 Input Presensi</button>
        <button className={`tf-tab ${tab === 'rekap' ? 'active' : ''}`} onClick={() => setTab('rekap')}>📊 Rekap Kehadiran</button>
      </div>

      {tab === 'input' && (
        <>
          <div className="tf-panel">
            <div className="tf-panel-head">Input Presensi</div>
            <div className="tf-panel-body">
              <div className="tf-field">
                <label>Tanggal</label>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="tf-field">
                <label>Materi (opsional)</label>
                <input value={materi} onChange={(e) => setMateri(e.target.value)} placeholder="Contoh: Setoran Jilid & Murojaah" />
              </div>

              {loading ? <div className="tf-empty">Memuat daftar siswa...</div> : santriList.length === 0 ? (
                <div className="tf-empty">Belum ada siswa binaan.</div>
              ) : (
                <>
                  <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tf-empty" style={{ margin: 0 }}>Set semua jadi:</span>
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s.key} className="tf-btn-sm" onClick={() => setAllStatus(s.key)}>{s.key}</button>
                    ))}
                  </div>
                  <div className="tf-table-wrap">
                    <table className="tf-table">
                      <thead><tr><th>Nama</th><th>Status Kehadiran</th></tr></thead>
                      <tbody>
                        {santriList.map((s) => (
                          <tr key={s.id}>
                            <td>{s.nama}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                {STATUS_OPTIONS.map((opt) => (
                                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 4, color: status[s.id] === opt.key ? opt.color : undefined, fontWeight: status[s.id] === opt.key ? 600 : 400 }}>
                                    <input
                                      type="radio"
                                      name={`status-${s.id}`}
                                      checked={status[s.id] === opt.key}
                                      onChange={() => setStatus({ ...status, [s.id]: opt.key })}
                                    />
                                    {opt.key}
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <button className="tf-btn" onClick={simpan} style={{ marginTop: 12 }}>Simpan Presensi</button>
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Riwayat Presensi</div>
            <div className="tf-panel-body tf-table-wrap">
              {riwayat.length === 0 ? <div className="tf-empty">Belum ada riwayat presensi.</div> : (
                <table className="tf-table">
                  <thead><tr><th>Tanggal</th><th>Nama Siswa</th><th>Status</th><th>Materi</th></tr></thead>
                  <tbody>
                    {riwayat.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.tanggal).substring(0, 10)}</td>
                        <td>{santriList.find((s) => String(s.id) === String(r.santri_id))?.nama || `#${r.santri_id}`}</td>
                        <td>{r.status}</td>
                        <td>{r.materi || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'rekap' && (
        <div className="tf-panel">
          <div className="tf-panel-head">Rekap Kehadiran</div>
          <div className="tf-panel-body">
            <div className="tf-field">
              <label>Dari Tanggal</label>
              <input type="date" value={rekapMulai} onChange={(e) => setRekapMulai(e.target.value)} />
            </div>
            <div className="tf-field">
              <label>Sampai Tanggal</label>
              <input type="date" value={rekapAkhir} onChange={(e) => setRekapAkhir(e.target.value)} />
            </div>
            <button className="tf-btn-sm" onClick={loadRekap} style={{ marginBottom: 12 }}>Terapkan Filter</button>

            {rekapLoading ? <div className="tf-empty">Memuat...</div> : rekap.length === 0 ? (
              <div className="tf-empty">Belum ada data presensi pada rentang ini.</div>
            ) : (
              <div className="tf-table-wrap">
                <table className="tf-table">
                  <thead><tr><th>Nama</th><th>Kelas</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alfa</th><th>Total</th><th>% Hadir</th></tr></thead>
                  <tbody>
                    {rekap.map((r) => (
                      <tr key={r.santri_id}>
                        <td>{r.nama}</td>
                        <td>{r.kelas_nama}</td>
                        <td>{r.hadir}</td>
                        <td>{r.izin}</td>
                        <td>{r.sakit}</td>
                        <td>{r.alfa}</td>
                        <td>{r.total}</td>
                        <td style={{ color: r.pct_hadir >= 80 ? 'var(--green)' : r.pct_hadir >= 60 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                          {r.pct_hadir}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
