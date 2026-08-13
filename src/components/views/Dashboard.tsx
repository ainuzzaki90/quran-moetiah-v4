'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

export default function DashboardView({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [terbaru, setTerbaru] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then((res) => { setStats(res.stats); setTerbaru(res.setoran_terbaru || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="tf-title">Dashboard</h1>
      {loading && <div className="tf-empty">Memuat...</div>}
      {error && <div className="tf-error">{error}</div>}
      {stats && (
        <div className="tf-stats">
          <div className="tf-stat-card c-green">
            <div className="label">Total Setoran</div>
            <div className="value">{stats.total_setoran}</div>
          </div>
          <div className="tf-stat-card c-cyan">
            <div className="label">Total Santri</div>
            <div className="value">{stats.total_santri}</div>
          </div>
          <div className="tf-stat-card c-gold">
            <div className="label">Rata-rata Nilai</div>
            <div className="value">{stats.rata_nilai}</div>
          </div>
          <div className="tf-stat-card c-green2">
            <div className="label">Setoran Bulan Ini</div>
            <div className="value">{stats.setoran_bulan_ini}</div>
          </div>
        </div>
      )}
      <div className="tf-panel">
        <div className="tf-panel-head">Setoran Terbaru</div>
        <div className="tf-panel-body">
          {terbaru.length === 0 ? (
            <div className="tf-empty">Belum ada data setoran.</div>
          ) : (
            <table className="tf-table">
              <thead>
                <tr><th>Tanggal</th><th>Jenis</th><th>Surah/Halaman</th><th>Nilai</th><th>Predikat</th></tr>
              </thead>
              <tbody>
                {terbuah(terbaru)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function terbuah(rows: any[]) {
  return rows.map((r) => (
    <tr key={r.id}>
      <td>{String(r.tanggal).substring(0, 10)}</td>
      <td>{r.jenis}</td>
      <td>{r.jenis === 'Setoran Metode Ummi' ? `Hal. ${r.halaman_selesai || r.halaman_mulai || '-'}` : (r.surah_selesai || r.surah || '-')}</td>
      <td>{r.nilai ?? '-'}</td>
      <td>{r.predikat || '-'}</td>
    </tr>
  ));
}
