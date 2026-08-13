'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

export default function StatistikView({ user }: { user: User }) {
  const [periode, setPeriode] = useState('bulanan');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load(p: string) {
    setLoading(true);
    api.get(`/statistik?periode=${p}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => load(periode), [periode]);

  return (
    <div>
      <h1 className="tf-title">Statistik</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Periode</label>
            <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="harian">Harian</option>
              <option value="pekanan">Pekanan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="tf-empty">Memuat...</div> : data && (
        <>
          <div className="tf-stats">
            <div className="tf-stat-card c-green">
              <div className="label">Total Setoran</div>
              <div className="value">{data.total_setoran}</div>
            </div>
            <div className="tf-stat-card c-gold">
              <div className="label">Rata-rata Nilai</div>
              <div className="value">{data.rata_nilai}</div>
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Peringkat Santri</div>
            <div className="tf-panel-body tf-table-wrap">
              {data.peringkat.length === 0 ? <div className="tf-empty">Belum ada data pada periode ini.</div> : (
                <table className="tf-table">
                  <thead>
                    <tr><th>#</th><th>Nama</th><th>Kelas</th><th>Total Setoran</th><th>Rata Nilai</th><th>Halaman Terakhir</th><th>Surah Terakhir</th></tr>
                  </thead>
                  <tbody>
                    {data.peringkat.map((p: any, i: number) => (
                      <tr key={p.santri_id}>
                        <td>{i + 1}</td>
                        <td>{p.nama}</td>
                        <td>{p.kelas_nama}</td>
                        <td>{p.total_setoran}</td>
                        <td>{p.rata_nilai}</td>
                        <td>{p.halaman_terakhir}</td>
                        <td>{p.surah_terakhir}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Distribusi per Jenis Setoran</div>
            <div className="tf-panel-body">
              {Object.keys(data.per_jenis).length === 0 ? <div className="tf-empty">Tidak ada data.</div> : (
                <ul>
                  {Object.entries(data.per_jenis).map(([k, v]) => (
                    <li key={k}>{k}: {v as any}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
