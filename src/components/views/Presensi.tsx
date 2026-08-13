'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

const STATUS_OPTIONS = ['Hadir', 'Izin', 'Sakit', 'Alfa'];

export default function PresensiView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().substring(0, 10));
  const [materi, setMateri] = useState('');
  const [status, setStatus] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [riwayat, setRiwayat] = useState<any[]>([]);

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

  async function simpan() {
    setError(''); setOk('');
    if (!santriList.length) { setError('Belum ada santri binaan untuk dipresensi'); return; }
    try {
      const rows = santriList.map((s) => ({ santri_id: s.id, kelas_id: s.kelas_id, status: status[s.id] || 'Hadir' }));
      await api.post('/presensi', { tanggal, materi, rows });
      setOk('Presensi berhasil disimpan.');
      load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="tf-title">Presensi</h1>
      {error && <div className="tf-error">{error}</div>}
      {ok && <div className="tf-empty">{ok}</div>}

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

          {loading ? <div className="tf-empty">Memuat daftar santri...</div> : santriList.length === 0 ? (
            <div className="tf-empty">Belum ada santri binaan.</div>
          ) : (
            <div className="tf-table-wrap">
              <table className="tf-table">
                <thead><tr><th>Nama</th><th>Status Kehadiran</th></tr></thead>
                <tbody>
                  {santriList.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nama}</td>
                      <td>
                        <select value={status[s.id] || 'Hadir'} onChange={(e) => setStatus({ ...status, [s.id]: e.target.value })}>
                          {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="tf-btn" onClick={simpan} style={{ marginTop: 12 }}>Simpan Presensi</button>
        </div>
      </div>

      <div className="tf-panel">
        <div className="tf-panel-head">Riwayat Presensi</div>
        <div className="tf-panel-body tf-table-wrap">
          {riwayat.length === 0 ? <div className="tf-empty">Belum ada riwayat presensi.</div> : (
            <table className="tf-table">
              <thead><tr><th>Tanggal</th><th>Santri ID</th><th>Status</th><th>Materi</th></tr></thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.tanggal).substring(0, 10)}</td>
                    <td>{r.santri_id}</td>
                    <td>{r.status}</td>
                    <td>{r.materi || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
