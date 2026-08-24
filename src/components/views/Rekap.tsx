'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api-client';
import { buildRaporHtml } from '@/lib/rapor';
import { downloadPdfSingle, downloadPdfBundle } from '@/lib/pdf-export';
import { showToast } from '@/lib/toast';
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
  const [pdfBusy, setPdfBusy] = useState<string | null>(null); // pesan progres saat generate PDF

  function load() {
    setLoading(true); setError('');
    api.get(`/rekap?tahun=${tahun}&bulan=${bulan}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [tahun, bulan]);

  function periodeMeta() {
    const periodeLabel = `${BULAN_NAMA[bulan]} ${tahun}`;
    return { periodeLabel, periodeRangLabel: periodeLabel, tahunAjaranLabel: `Tahun Ajaran ${data.tahun_ajaran} (Semester ${data.semester})` };
  }

  function exportRekapExcel() {
    if (!data || !data.data.length) { alert('Tidak ada data untuk diexport.'); return; }

    const ringkasan = data.data.map((d: any) => ({
      Nama: d.nama, NIS: d.nis, Kelas: d.kelas_nama, 'Level Ummi': d.level_ummi,
      'Guru Pengampu': d.penyimak_nama || '', 'Total Setoran': d.total_setoran, 'Rata-rata Nilai': d.rata_nilai,
      'Halaman Terakhir': d.halaman_terakhir, 'Surah Terakhir': d.surah_terakhir,
    }));

    const detail: any[] = [];
    data.data.forEach((d: any) => {
      (d.detail || []).forEach((r: any) => {
        detail.push({
          Nama: d.nama, Kelas: d.kelas_nama, Tanggal: String(r.tanggal).substring(0, 10),
          Jenis: r.jenis, Nilai: r.nilai ?? '', Predikat: r.predikat || '',
          'Halaman/Surah': r.jenis === 'Setoran Metode Ummi' ? `${r.halaman_mulai}-${r.halaman_selesai}` : `${r.surah || ''} ${r.ayat_mulai || ''}-${r.ayat_selesai || ''}`,
          Catatan: r.catatan || '',
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasan), 'Ringkasan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Detail Setoran');
    XLSX.writeFile(wb, `Laporan-${BULAN_NAMA[bulan]}-${tahun}.xlsx`);
    showToast('Excel berhasil diunduh');
  }

  function cetakRapor(d: any) {
    const el = document.createElement('div');
    el.className = 'tf-hide';
    el.innerHTML = buildRaporHtml(d, periodeMeta());
    document.body.appendChild(el);
    el.classList.remove('tf-hide');
    window.print();
    document.body.removeChild(el);
  }

  async function unduhPdfSatu(d: any) {
    setPdfBusy(`Menyiapkan PDF ${d.nama}...`);
    try {
      const html = buildRaporHtml(d, periodeMeta());
      await downloadPdfSingle(html, `Rapor-${d.nama}-${BULAN_NAMA[bulan]}-${tahun}.pdf`);
      showToast('PDF berhasil diunduh');
    } catch (e: any) {
      setError('Gagal membuat PDF: ' + e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  async function unduhPdfSekelas() {
    if (!data || !data.data.length) { alert('Tidak ada data untuk diexport.'); return; }
    const meta = periodeMeta();
    const htmls = data.data.map((d: any) => buildRaporHtml(d, meta));
    try {
      await downloadPdfBundle(htmls, `Rapor-Sekelas-${BULAN_NAMA[bulan]}-${tahun}.pdf`, (i, total) => {
        setPdfBusy(`Menyiapkan PDF ${i} dari ${total} siswa...`);
      });
      showToast(`${htmls.length} rapor berhasil digabung jadi 1 PDF`);
    } catch (e: any) {
      setError('Gagal membuat PDF gabungan: ' + e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div>
      <h1 className="tf-title">Rekap & Rapor Bulanan</h1>
      {error && <div className="tf-error">{error}</div>}
      {pdfBusy && <div className="tf-empty">⏳ {pdfBusy}</div>}

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
          <div className="tf-panel-head" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Rapor {BULAN_NAMA[bulan]} {tahun} — Tahun Ajaran {data.tahun_ajaran} (Semester {data.semester})</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="tf-btn-sm" onClick={exportRekapExcel} disabled={!!pdfBusy}>⬇ Export Excel</button>
              <button className="tf-btn-sm" onClick={unduhPdfSekelas} disabled={!!pdfBusy || data.data.length === 0}>📄 Unduh PDF Sekelas (gabung)</button>
            </div>
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
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="tf-btn-sm" onClick={() => cetakRapor(d)} disabled={!!pdfBusy}>🖨 Print</button>{' '}
                          <button className="tf-btn-sm" onClick={() => unduhPdfSatu(d)} disabled={!!pdfBusy}>⬇ PDF</button>
                        </td>
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
    </div>
  );
}
