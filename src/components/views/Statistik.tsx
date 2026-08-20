'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function StatistikView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [periode, setPeriode] = useState('bulanan');
  const [tanggalRef, setTanggalRef] = useState(new Date().toISOString().substring(0, 10));
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().substring(0, 10));
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().substring(0, 10));
  const [santriId, setSantriId] = useState('all');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rata_nilai' | 'total_setoran'>('rata_nilai');

  useEffect(() => {
    api.get('/santri').then((res) => setSantriList(res.data)).catch((e) => setError(e.message));
  }, []);

  function loadStatistik() {
    setLoading(true); setError('');
    const params = new URLSearchParams({ periode, santri_id: santriId });
    if (periode === 'tentatif') {
      params.set('tanggal_mulai', tanggalMulai);
      params.set('tanggal_selesai', tanggalSelesai);
    } else {
      params.set('tanggal_referensi', tanggalRef);
    }
    api.get(`/statistik?${params.toString()}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(loadStatistik, []);

  const peringkatSorted = data ? [...(data.peringkat || [])].sort((a: any, b: any) => (b[sortBy] || 0) - (a[sortBy] || 0)) : [];
  const days = data ? Object.keys(data.per_hari || {}).sort() : [];
  const maxCount = Math.max(1, ...days.map((d) => data.per_hari[d]));

  return (
    <div>
      <h1 className="tf-title">Statistik Setoran</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-stat-filter">
            <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="harian">Harian</option>
              <option value="pekanan">Pekanan (Mingguan)</option>
              <option value="bulanan">Bulanan</option>
              <option value="tentatif">Tentatif (Rentang Tanggal)</option>
            </select>
            {periode !== 'tentatif' ? (
              <input type="date" value={tanggalRef} onChange={(e) => setTanggalRef(e.target.value)} />
            ) : (
              <>
                <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
                <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
              </>
            )}
            <select value={santriId} onChange={(e) => setSantriId(e.target.value)}>
              <option value="all">Semua Siswa</option>
              {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
            <button className="tf-btn-sm" onClick={loadStatistik}>Tampilkan</button>
          </div>

          {loading ? <div className="tf-empty">Memuat...</div> : !data ? (
            <div className="tf-empty">Pilih filter lalu klik Tampilkan.</div>
          ) : (
            <>
              <div className="tf-stats">
                <div className="tf-stat-card c-cyan"><div className="label">TOTAL SETORAN</div><div className="value">{data.total_setoran}</div></div>
                <div className="tf-stat-card c-red"><div className="label">RATA-RATA NILAI</div><div className="value">{data.rata_nilai.toFixed(2)}</div></div>
                <div className="tf-stat-card c-green"><div className="label">HAFALAN BARU</div><div className="value">{data.per_jenis['Hafalan Baru'] || 0}</div></div>
                <div className="tf-stat-card c-green2"><div className="label">MUROJAAH</div><div className="value">{data.per_jenis['Murojaah'] || 0}</div></div>
              </div>

              <h3 style={{ color: 'var(--heading)', fontSize: 15 }}>Grafik Setoran per Hari</h3>
              <div className="tf-bar-chart">
                {days.length === 0 ? <div className="tf-empty">Tidak ada data pada rentang ini.</div> : days.map((tgl) => (
                  <div className="tf-bar-row" key={tgl}>
                    <span className="tf-bar-label">{tgl}</span>
                    <div className="tf-bar-track"><div className="tf-bar-fill" style={{ width: `${(data.per_hari[tgl] / maxCount) * 100}%` }} /></div>
                    <span className="tf-bar-value">{data.per_hari[tgl]}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                <h3 style={{ color: 'var(--heading)', fontSize: 15, margin: 0 }}>🏆 Peringkat Capaian Siswa</h3>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="rata_nilai">Urutkan: Rata-rata Nilai Tertinggi</option>
                  <option value="total_setoran">Urutkan: Total Setoran Terbanyak</option>
                </select>
              </div>

              {peringkatSorted.length === 0 ? <div className="tf-empty">Tidak ada data siswa pada filter ini.</div> : (
                <div className="tf-table-wrap">
                  <table className="tf-table">
                    <thead>
                      <tr><th>#</th><th>Nama</th><th>Kelas</th><th>Level Ummi</th><th>Halaman Terakhir</th><th>Surah Terakhir</th><th>Total Setoran</th><th>Rata-rata Nilai</th></tr>
                    </thead>
                    <tbody>
                      {peringkatSorted.map((d: any, i: number) => (
                        <tr key={d.santri_id}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{MEDALS[i] || i + 1}</td>
                          <td>{d.nama}</td>
                          <td>{d.kelas_nama}</td>
                          <td>{d.level_ummi}</td>
                          <td>{d.halaman_terakhir || '-'}</td>
                          <td>{d.surah_terakhir || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'total_setoran' ? 700 : undefined }}>{d.total_setoran}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'rata_nilai' ? 700 : undefined }}>{d.rata_nilai}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
