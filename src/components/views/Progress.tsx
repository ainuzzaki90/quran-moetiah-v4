'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

export default function ProgressView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [santriId, setSantriId] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user.role === 'santri') {
      loadProgress('');
      return;
    }
    api.get('/santri?binaan_only=1').then((res) => setSantriList(res.data)).catch((e) => setError(e.message));
  }, []);

  function loadProgress(id: string) {
    setLoading(true); setError('');
    api.get(`/progress${id ? `?santri_id=${id}` : ''}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <h1 className="tf-title">Progress Siswa</h1>
      {error && <div className="tf-error">{error}</div>}

      {user.role !== 'santri' && (
        <div className="tf-panel">
          <div className="tf-panel-body">
            <div className="tf-field">
              <label>Pilih Santri</label>
              <select value={santriId} onChange={(e) => { setSantriId(e.target.value); if (e.target.value) loadProgress(e.target.value); }}>
                <option value="">- Pilih Santri -</option>
                {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="tf-empty">Memuat...</div>}

      {data && (
        <>
          <div className="tf-panel">
            <div className="tf-panel-head">{data.santri.nama} — {data.santri.kelas_nama}</div>
            <div className="tf-panel-body">
              <p>Rentang: {data.rentang.mulai} s/d {data.rentang.akhir}</p>
              <p>Total setoran pada rentang ini: <b>{data.total_setoran}</b>, rata-rata nilai: <b>{data.rata_nilai}</b></p>
              <p>Tren nilai: <b>{data.tren.arah}</b> (perubahan {data.tren.delta > 0 ? '+' : ''}{data.tren.delta} dari rata {data.tren.rata_awal} menjadi {data.tren.rata_akhir})</p>
              <p>Posisi halaman terakhir: <b>{data.halaman_terakhir ? data.halaman_terakhir.label : '-'}</b></p>
              <p>Posisi surah/hafalan terakhir: <b>{data.surah_terakhir ? data.surah_terakhir.label : '-'}</b></p>
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Kehadiran pada Rentang Ini</div>
            <div className="tf-panel-body">
              <p>Hadir: {data.kehadiran.hadir} · Izin: {data.kehadiran.izin} · Sakit: {data.kehadiran.sakit} · Alfa: {data.kehadiran.alfa}</p>
              {data.kehadiran.pct_hadir !== null && <p>Persentase kehadiran: <b>{data.kehadiran.pct_hadir}%</b></p>}
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Rata-rata Nilai per Pekan</div>
            <div className="tf-panel-body">
              {Object.keys(data.nilai_per_minggu).length === 0 ? <div className="tf-empty">Belum ada data.</div> : (
                <ul>
                  {Object.entries(data.nilai_per_minggu).map(([k, v]) => (
                    <li key={k}>Pekan mulai {k}: {v as any}</li>
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
