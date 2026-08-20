'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

function todayStr() { return new Date().toISOString().substring(0, 10); }
function mulaiDefaultStr() { return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10); }

const BADGE_CLS: Record<string, string> = {
  'Murojaah': 'b-murajaah', 'Tilawah': 'b-tilawah', 'Setoran Metode Ummi': 'b-ummi',
};

export default function ProgressView({ user }: { user: User }) {
  const isSantri = user.role === 'santri';
  const [santriList, setSantriList] = useState<any[]>([]);
  const [santriId, setSantriId] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(mulaiDefaultStr());
  const [tanggalAkhir, setTanggalAkhir] = useState(todayStr());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSantri) { loadProgress(''); return; }
    api.get(`/santri?binaan_only=${user.role === 'penyimak' ? '1' : ''}`)
      .then((res) => setSantriList(res.data))
      .catch((e) => setError(e.message));
  }, []);

  function loadProgress(id: string) {
    if (!isSantri && !id) { setError('Pilih siswa terlebih dahulu.'); return; }
    setLoading(true); setError('');
    const params = new URLSearchParams({ tanggal_mulai: tanggalMulai, tanggal_akhir: tanggalAkhir });
    if (!isSantri) params.set('santri_id', id);
    api.get(`/progress?${params.toString()}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const weeks = data ? Object.keys(data.nilai_per_minggu || {}).sort() : [];
  const maxNilai = Math.max(1, ...weeks.map((w) => data?.nilai_per_minggu[w] || 0));

  const trenBadge = data && (
    data.tren.arah === 'naik' ? (
      <span className="tf-badge" style={{ background: '#dcfce7', color: '#166534' }}>▲ Naik {data.tren.delta > 0 ? '+' : ''}{data.tren.delta}</span>
    ) : data.tren.arah === 'turun' ? (
      <span className="tf-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>▼ Turun {data.tren.delta}</span>
    ) : (
      <span className="tf-badge" style={{ background: '#f1f5f9', color: '#475569' }}>→ Stabil</span>
    )
  );

  return (
    <div>
      <h1 className="tf-title">Progress Siswa</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-stat-filter">
            {!isSantri && (
              <select value={santriId} onChange={(e) => setSantriId(e.target.value)}>
                <option value="">-- pilih siswa --</option>
                {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            )}
            <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
            <input type="date" value={tanggalAkhir} onChange={(e) => setTanggalAkhir(e.target.value)} />
            <button className="tf-btn-sm" onClick={() => loadProgress(santriId)}>Tampilkan</button>
          </div>

          {loading ? <div className="tf-empty">Memuat...</div> : !data ? (
            <div className="tf-empty">Pilih siswa lalu klik Tampilkan.</div>
          ) : (
            <>
              <h2 style={{ color: 'var(--heading)', fontSize: 17, margin: '0 0 4px' }}>
                {data.santri.nama}{' '}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>
                  — {data.santri.kelas_nama} · Level {data.santri.level_ummi}
                </span>
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Rentang: {data.rentang.mulai} s/d {data.rentang.akhir}
              </p>
              <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 14 }}>
                📄 Halaman terakhir: <b>{data.halaman_terakhir ? data.halaman_terakhir.label : 'Belum ada'}</b>
                {data.halaman_terakhir && <span style={{ color: 'var(--text-muted)' }}> ({String(data.halaman_terakhir.tanggal).substring(0, 10)})</span>}
                <br />
                📖 Surah terakhir: <b>{data.surah_terakhir ? data.surah_terakhir.label : 'Belum ada'}</b>
                {data.surah_terakhir && <span style={{ color: 'var(--text-muted)' }}> ({String(data.surah_terakhir.tanggal).substring(0, 10)})</span>}
              </div>

              <div className="tf-stats">
                <div className="tf-stat-card c-cyan"><div className="label">TOTAL SETORAN</div><div className="value">{data.total_setoran}</div></div>
                <div className="tf-stat-card c-red"><div className="label">RATA-RATA NILAI</div><div className="value">{data.rata_nilai}</div></div>
                <div className="tf-stat-card c-green"><div className="label">TREN NILAI</div><div className="value" style={{ fontSize: 16 }}>{trenBadge}</div></div>
              </div>

              <h3 style={{ color: 'var(--heading)', fontSize: 15, marginTop: 18 }}>Tren Rata-rata Nilai per Minggu</h3>
              <div className="tf-bar-chart">
                {weeks.length === 0 ? <div className="tf-empty">Belum ada setoran bernilai pada rentang ini.</div> : weeks.map((wk) => (
                  <div className="tf-bar-row" key={wk}>
                    <span className="tf-bar-label">{wk}</span>
                    <div className="tf-bar-track"><div className="tf-bar-fill" style={{ width: `${(data.nilai_per_minggu[wk] / maxNilai) * 100}%` }} /></div>
                    <span className="tf-bar-value">{data.nilai_per_minggu[wk]}</span>
                  </div>
                ))}
              </div>

              <h3 style={{ color: 'var(--heading)', fontSize: 15, marginTop: 18 }}>Konsistensi Kehadiran</h3>
              {data.kehadiran.total > 0 ? (
                <div className="tf-stats">
                  <div className="tf-stat-card c-green"><div className="label">HADIR</div><div className="value">{data.kehadiran.hadir}</div></div>
                  <div className="tf-stat-card c-gold"><div className="label">IZIN/SAKIT</div><div className="value">{data.kehadiran.izin + data.kehadiran.sakit}</div></div>
                  <div className="tf-stat-card c-red"><div className="label">ALFA</div><div className="value">{data.kehadiran.alfa}</div></div>
                  <div className="tf-stat-card c-cyan"><div className="label">% KEHADIRAN</div><div className="value">{data.kehadiran.pct_hadir}%</div></div>
                </div>
              ) : <div className="tf-empty">Belum ada data presensi pada rentang ini.</div>}

              <h3 style={{ color: 'var(--heading)', fontSize: 15, marginTop: 18 }}>Riwayat Nilai Setoran</h3>
              <div className="tf-table-wrap">
                <table className="tf-table">
                  <thead><tr><th>Tanggal</th><th>Jenis</th><th>Nilai</th><th>Predikat</th></tr></thead>
                  <tbody>
                    {data.nilai_trend.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af' }}>Belum ada data</td></tr>
                    ) : [...data.nilai_trend].reverse().map((n: any, i: number) => (
                      <tr key={i}>
                        <td>{n.tanggal}</td>
                        <td><span className={`tf-badge ${BADGE_CLS[n.jenis] || 'b-hafalan'}`}>{n.jenis || '-'}</span></td>
                        <td style={{ textAlign: 'center' }}>{n.nilai}</td>
                        <td>{n.predikat || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
