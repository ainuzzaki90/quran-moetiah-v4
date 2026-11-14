'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/menu';
import HalaqahSelect, { useHalaqah } from '../HalaqahSelect';
import { LineChart, BarRows } from '../charts';
import type { User } from '../AppShell';

const PERIODE_OPTIONS = [['bulan_ini', 'Bulan ini'], ['bulan_lalu', 'Bulan lalu'], ['semua', 'Semua waktu']] as const;
const PREDIKAT_WARNA: Record<string, string> = {
  'Mumtaz': 'var(--forest)', 'Jayyid Jiddan': 'var(--navy-light)', 'Jayyid': 'var(--gold)', 'Maqbul': '#d97706', 'Dhoif': 'var(--red)',
};

export default function DashboardView({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [terbaru, setTerbaru] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { list: halaqahList } = useHalaqah();
  const [halaqahId, setHalaqahId] = useState('semua');
  const [periode, setPeriode] = useState<'bulan_ini' | 'bulan_lalu' | 'semua'>('bulan_ini');
  const [st, setSt] = useState<any>(null);
  const [stLoading, setStLoading] = useState(true);
  const [stError, setStError] = useState('');
  const [prestasi, setPrestasi] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/dashboard?halaqah_id=${halaqahId}`)
      .then((res) => { setStats(res.stats); setTerbaru(res.setoran_terbaru || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [halaqahId]);

  // Statistik dimuat terpisah (paralel) agar kartu & setoran terbaru tampil lebih dulu
  useEffect(() => {
    setStLoading(true); setStError('');
    api.get(`/dashboard/statistik?halaqah_id=${halaqahId}&periode=${periode}`)
      .then((res) => setSt(res))
      .catch((e) => setStError(e.message))
      .finally(() => setStLoading(false));
  }, [halaqahId, periode]);

  // Papan prestasi (perhitungan lebih berat) dimuat sekali, tidak bergantung filter
  useEffect(() => {
    if (user.role === 'santri') return;
    api.get('/dashboard/prestasi').then(setPrestasi).catch(() => setPrestasi({ top_poin: [], per_kelas: [], error: true }));
  }, [user.role]);

  return (
    <div>
      <h1 className="tf-title">Dashboard {ROLE_LABELS[user.role]}</h1>
      <div className="tf-dash-filters">
        <HalaqahSelect list={halaqahList} value={halaqahId} onChange={setHalaqahId} allowAll />
        <div className="tf-field">
          <label>Periode statistik</label>
          <select value={periode} onChange={(e) => setPeriode(e.target.value as any)}>
            {PERIODE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      {loading && <div className="tf-empty">Memuat...</div>}
      {error && <div className="tf-error">{error}</div>}
      {stats && (
        <div className="tf-stats">
          <div className="tf-stat-card c-green">
            <div className="label">Total Setoran</div>
            <div className="value">{stats.total_setoran}</div>
          </div>
          <div className="tf-stat-card c-cyan">
            <div className="label">Total Siswa</div>
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
      {stError && <div className="tf-error">{stError}</div>}
      {stLoading && !st && <div className="tf-empty">Memuat statistik...</div>}
      {st && st.kosong && <div className="tf-empty">Belum ada data siswa untuk ditampilkan statistiknya.</div>}
      {st && !st.kosong && <StatistikSections st={st} role={user.role} prestasi={prestasi} loading={stLoading} />}

      <div className="tf-panel">
        <div className="tf-panel-head">Setoran Terbaru</div>
        <div className="tf-panel-body">
          {terbaru.length === 0 ? (
            <div className="tf-empty">Belum ada data setoran.</div>
          ) : (
            <table className="tf-table">
              <thead>
                <tr><th>Tanggal</th><th>Nama Siswa</th><th>Kelas</th><th>Halaqah</th><th>Guru Pengampu</th><th>Jenis</th><th>Surah/Halaman</th><th>Nilai</th><th>Predikat</th></tr>
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
      <td>{r.nama_siswa || '-'}</td>
      <td>{r.kelas_nama || '-'}</td>
      <td>{r.halaqah_nama || '-'}</td>
      <td>{r.guru_pengampu || '-'}</td>
      <td>{r.jenis}</td>
      <td>{r.jenis === 'Setoran Metode Ummi' ? `Hal. ${r.halaman_selesai || r.halaman_mulai || '-'}` : (r.surah_selesai || r.surah || '-')}</td>
      <td>{r.nilai ?? '-'}</td>
      <td>{r.predikat || '-'}</td>
    </tr>
  ));
}


function Delta({ ini, lalu }: { ini: number | null; lalu: number | null }) {
  if (ini === null || lalu === null) return <span>belum ada pembanding bulan lalu</span>;
  const d = Math.round((ini - lalu) * 10) / 10;
  if (d === 0) return <span>sama dengan bulan lalu ({lalu})</span>;
  return <span style={{ color: d > 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)} dari bulan lalu ({lalu})</span>;
}

function StatistikSections({ st, role, prestasi, loading }: { st: any; role: string; prestasi: any; loading: boolean }) {
  const k = st.kartu;
  const adaHadir = (k.hadir_hari_ini || []).some((h: any) => h.total > 0);
  const totalBelumGuru = (k.belum_guru || []).reduce((a: number, b: any) => a + b.belum, 0);
  const periodeLabel = st.periode_label;
  const persenAktif = st.total_siswa ? Math.round((k.aktif_minggu / st.total_siswa) * 100) : 0;
  const totalPredikat = st.predikat.reduce((a: number, b: any) => a + b.jumlah, 0);
  const isSiswa = role === 'santri';
  const jam = (t: string) => String(t).split('-').reverse().join('/');

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      {/* A. kartu ringkas */}
      <div className="tf-mini-stats">
        <div className="tf-mini">
          <div className="label">{isSiswa ? 'Setor minggu ini' : 'Siswa setor minggu ini'}</div>
          <div className="value">{isSiswa ? (k.aktif_minggu ? 'Sudah' : 'Belum') : `${k.aktif_minggu} / ${st.total_siswa}`}</div>
          {!isSiswa && <div className="sub">{persenAktif}% siswa (Senin–hari ini)</div>}
        </div>
        <div className="tf-mini">
          <div className="label">Rata-rata nilai bulan ini</div>
          <div className="value">{k.rata_bulan_ini ?? '-'}</div>
          <div className="sub"><Delta ini={k.rata_bulan_ini} lalu={k.rata_bulan_lalu} /></div>
        </div>
        {k.siap_ujian !== null && k.siap_ujian !== undefined && (
          <div className="tf-mini">
            <div className="label">Siap ujian kenaikan jilid</div>
            <div className="value">{k.siap_ujian}</div>
            <div className="sub">siswa, belum dicatat ujiannya</div>
          </div>
        )}
        {k.belum_guru && (
          <div className="tf-mini">
            <div className="label">Siswa belum punya guru</div>
            <div className="value" style={{ color: totalBelumGuru ? '#b45309' : undefined }}>{totalBelumGuru}</div>
            <div className="sub">{k.belum_guru.map((b: any) => `${b.nama}: ${b.belum}`).join(' · ') || '-'}</div>
          </div>
        )}
        <div className="tf-mini">
          <div className="label">Kehadiran hari ini ({jam(st.hari_ini)})</div>
          {adaHadir ? (
            <div style={{ marginTop: 6 }}>
              {k.hadir_hari_ini.map((h: any) => (
                <div key={h.halaqah_id} style={{ fontSize: 13, margin: '3px 0' }}>
                  <b>{h.nama}</b>: {h.total ? <>{h.hadir} hadir dari {h.total}{h.alfa + h.sakit + h.izin > 0 && <div className="tf-muted">{h.izin} izin, {h.sakit} sakit, {h.alfa} alfa</div>}</> : <span className="tf-muted">belum ada presensi</span>}
                </div>
              ))}
            </div>
          ) : <div className="sub" style={{ marginTop: 8 }}>Belum ada presensi tercatat hari ini.</div>}
        </div>
      </div>

      {/* B. grafik */}
      <div className="tf-panel">
        <div className="tf-panel-head">Tren Setoran per Minggu (12 minggu terakhir)</div>
        <div className="tf-panel-body"><LineChart data={st.tren.map((t: any) => ({ label: t.label, value: t.jumlah }))} /></div>
      </div>

      <div className="tf-dash-grid">
        <div className="tf-panel">
          <div className="tf-panel-head">Sebaran Predikat — {periodeLabel}</div>
          <div className="tf-panel-body">
            {totalPredikat === 0 ? <div className="tf-empty">Belum ada nilai pada periode ini.</div> : (
              <BarRows
                rows={st.predikat.map((p: any) => ({ label: p.predikat, value: p.jumlah, color: PREDIKAT_WARNA[p.predikat], note: `${Math.round((p.jumlah / totalPredikat) * 100)}% dari seluruh nilai` }))}
              />
            )}
          </div>
        </div>
        <div className="tf-panel">
          <div className="tf-panel-head">Rata-rata per Aspek — {periodeLabel}</div>
          <div className="tf-panel-body">
            {st.aspek.every((a: any) => a.rata === null) ? <div className="tf-empty">Belum ada setoran dengan penilaian 4 aspek pada periode ini.</div> : (
              <>
                <BarRows max={100} rows={st.aspek.map((a: any) => ({ label: a.aspek, value: a.rata }))} />
                {(() => {
                  const ada = st.aspek.filter((a: any) => a.rata !== null);
                  const terendah = ada.reduce((m: any, a: any) => (a.rata < m.rata ? a : m), ada[0]);
                  return <p className="tf-empty" style={{ textAlign: 'left' }}>Aspek paling lemah: <b>{terendah.aspek}</b> ({terendah.rata}).</p>;
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {!isSiswa && (
        <div className="tf-panel">
          <div className="tf-panel-head">Setoran per Kelas — {periodeLabel}</div>
          <div className="tf-panel-body">
            {st.per_kelas.length === 0 ? <div className="tf-empty">Belum ada setoran pada periode ini.</div> : (
              <BarRows rows={st.per_kelas.map((c: any) => ({ label: c.kelas, value: c.jumlah, note: `${c.siswa_setor} siswa setor · rata-rata ${c.rata ?? '-'}` }))} />
            )}
          </div>
        </div>
      )}

      {/* C. daftar tindakan */}
      {!isSiswa && (
        <div className="tf-dash-grid">
          <div className="tf-panel">
            <div className="tf-panel-head">Nilai Dhoif Berulang</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>Siswa dengan nilai di bawah 60 pada minimal 2 dari 3 setoran terakhir (60 hari terakhir).</p>
              {st.dhoif_berulang.length === 0 ? <div className="tf-empty">Tidak ada. 👍</div> : (
                <table className="tf-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Dhoif</th><th>Rata</th></tr></thead>
                  <tbody>{st.dhoif_berulang.map((d: any) => <tr key={d.santri_id}><td>{d.nama}</td><td>{d.kelas}</td><td>{d.dhoif} dari {d.dari}</td><td>{d.rata ?? '-'}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
          <div className="tf-panel">
            <div className="tf-panel-head">Perlu Perhatian Presensi — Bulan Ini</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>Siswa dengan ketidakhadiran terbanyak bulan ini (diurutkan Alfa lalu total).</p>
              {st.presensi_perhatian.length === 0 ? <div className="tf-empty">Tidak ada ketidakhadiran tercatat. 👍</div> : (
                <table className="tf-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Alfa</th><th>Sakit</th><th>Izin</th></tr></thead>
                  <tbody>{st.presensi_perhatian.map((d: any) => <tr key={d.santri_id}><td>{d.nama}</td><td>{d.kelas}</td><td>{d.alfa}</td><td>{d.sakit}</td><td>{d.izin}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* D. papan prestasi */}
      {!isSiswa && (
        <div className="tf-dash-grid">
          <div className="tf-panel">
            <div className="tf-panel-head">🏆 Top 10 Poin Prestasi Hafalan</div>
            <div className="tf-panel-body">
              {!prestasi ? <div className="tf-empty">Memuat...</div> : prestasi.error ? <div className="tf-empty">Gagal memuat papan prestasi.</div> :
                (prestasi.top_poin || []).length === 0 ? <div className="tf-empty">Belum ada poin prestasi.</div> : (
                  <table className="tf-table"><thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Halaman</th><th>Poin</th></tr></thead>
                    <tbody>{prestasi.top_poin.map((p: any, i: number) => <tr key={p.santri_id}><td>{i + 1}</td><td>{p.nama}</td><td>{p.kelas}</td><td>{p.halaman_hafal}</td><td><b>{p.poin}</b></td></tr>)}</tbody></table>
                )}
            </div>
          </div>
          <div className="tf-panel">
            <div className="tf-panel-head">⭐ Rajin Setor — {periodeLabel}</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>Jumlah hari berbeda siswa melakukan setoran.</p>
              {st.rajin.length === 0 ? <div className="tf-empty">Belum ada setoran pada periode ini.</div> : (
                <table className="tf-table"><thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Hari setor</th></tr></thead>
                  <tbody>{st.rajin.map((p: any, i: number) => <tr key={p.santri_id}><td>{i + 1}</td><td>{p.nama}</td><td>{p.kelas}</td><td><b>{p.hari_setor}</b></td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}

      {!isSiswa && (
        <div className="tf-panel">
          <div className="tf-panel-head">Hafalan Tertinggi per Kelas</div>
          <div className="tf-panel-body">
            {!prestasi ? <div className="tf-empty">Memuat...</div> : (prestasi.per_kelas || []).length === 0 ? <div className="tf-empty">Belum ada data hafalan.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tf-table"><thead><tr><th>Kelas</th><th>Siswa</th><th>Hafalan Tertinggi</th><th>Halaman</th></tr></thead>
                  <tbody>{prestasi.per_kelas.map((p: any) => <tr key={p.kelas}><td>{p.kelas}</td><td>{p.nama}</td><td>{p.hafalan_tertinggi}</td><td>{p.halaman_hafal}</td></tr>)}</tbody></table>
              </div>
            )}
          </div>
        </div>
      )}

      {st.banding_guru && (
        <div className="tf-panel">
          <div className="tf-panel-head">Perbandingan Guru Pengampu — {periodeLabel}</div>
          <div className="tf-panel-body">
            {st.banding_guru.length === 0 ? <div className="tf-empty">Belum ada data.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tf-table"><thead><tr><th>Guru</th><th>Siswa binaan</th><th>Setoran dicatat</th><th>Rata-rata nilai</th></tr></thead>
                  <tbody>{st.banding_guru.map((g: any) => <tr key={g.penyimak_id}><td>{g.nama}</td><td>{g.siswa_binaan}</td><td>{g.setoran}</td><td>{g.rata ?? '-'}</td></tr>)}</tbody></table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
