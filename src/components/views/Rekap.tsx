'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api-client';
import { buildRaporHtml } from '@/lib/rapor';
import type { User } from '../AppShell';

const BULAN_NAMA = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function RekapView({ user }: { user: User }) {
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const raporRef = useRef<HTMLDivElement>(null);

  function load() {
    setLoading(true); setError('');
    api.get(`/rekap?tahun=${tahun}&bulan=${bulan}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [tahun, bulan]);

  function exportRekapExcel() {
    if (!data || !data.data.length) { alert('Tidak ada data untuk diexport.'); return; }
    const rows = data.data.map((d: any) => ({
      Nama: d.nama, NIS: d.nis, Kelas: d.kelas_nama, 'Level Ummi': d.level_ummi,
      'Guru Pengampu': d.penyimak_nama || '', 'Total Setoran': d.total_setoran, 'Rata-rata Nilai': d.rata_nilai,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `Rekap-${tahun}.xlsx`);
  }

  function cetakRapor(d: any) {
    if (!raporRef.current) return;
    const periodeLabel = `${BULAN_NAMA[bulan]} ${tahun}`;
    raporRef.current.innerHTML = buildRaporHtml(d, {
      periodeLabel,
      periodeRangLabel: periodeLabel,
      tahunAjaranLabel: `Tahun Ajaran ${data.tahun_ajaran} (Semester ${data.semester})`,
    });
    raporRef.current.classList.remove('tf-hide');
    window.print();
    raporRef.current.classList.add('tf-hide');
  }

  return (
    <div>
      <h1 className="tf-title">Rekap & Rapor Bulanan</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Bulan</label>
            <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
              {BULAN_NAMA.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
            </select>
          </div>
          <div className="tf-field">
            <label>Tahun</label>
            <input type="number" value={tahun} onChange={(e) => setTahun(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {loading ? <div className="tf-empty">Memuat...</div> : data && (
        <div className="tf-panel">
          <div className="tf-panel-head" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span>Rapor {BULAN_NAMA[bulan]} {tahun} — Tahun Ajaran {data.tahun_ajaran} (Semester {data.semester})</span>
            <button className="tf-btn-sm" onClick={exportRekapExcel}>⬇ Export Excel</button>
          </div>
          <div className="tf-panel-body tf-table-wrap">
            {data.data.length === 0 ? <div className="tf-empty">Tidak ada data pada periode ini.</div> : (
              <table className="tf-table">
                <thead>
                  <tr><th>Nama</th><th>Kelas</th><th>Penyimak</th><th>Total Setoran</th><th>Rata Nilai</th><th>Halaman Terakhir</th><th>Surah Terakhir</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {data.data.map((d: any) => (
                    <>
                      <tr key={d.santri_id}>
                        <td style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.santri_id ? null : d.santri_id)}>{d.nama}</td>
                        <td>{d.kelas_nama}</td>
                        <td>{d.penyimak_nama || '-'}</td>
                        <td>{d.total_setoran}</td>
                        <td>{d.rata_nilai}</td>
                        <td>{d.halaman_terakhir}</td>
                        <td>{d.surah_terakhir}</td>
                        <td><button className="tf-btn-sm" onClick={() => cetakRapor(d)}>🖨 Cetak Rapor</button></td>
                      </tr>
                      {expanded === d.santri_id && (
                        <tr key={`${d.santri_id}-detail`}>
                          <td colSpan={8}>
                            {d.detail.length === 0 ? 'Tidak ada rincian.' : (
                              <table className="tf-table">
                                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Nilai</th><th>Predikat</th></tr></thead>
                                <tbody>
                                  {d.detail.map((r: any) => (
                                    <tr key={r.id}>
                                      <td>{String(r.tanggal).substring(0, 10)}</td>
                                      <td>{r.jenis}</td>
                                      <td>{r.nilai ?? '-'}</td>
                                      <td>{r.predikat || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div id="tf-rapor-print" ref={raporRef} className="tf-hide" />
    </div>
  );
}
