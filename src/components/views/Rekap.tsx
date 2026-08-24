'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api-client';
import { buildRaporHtml } from '@/lib/rapor';
import { downloadPdfSingle, downloadPdfBundle } from '@/lib/pdf-export';
import { showToast } from '@/lib/toast';
import type { User } from '../AppShell';

const BULAN_NAMA = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

type Mode = 'bulanan' | 'semester' | 'kustom';

export default function RekapView({ user }: { user: User }) {
  const now = new Date();
  // Tahun ajaran berjalan (Juli-Juni): kalau sekarang bulan 1-6, tahun ajaran dimulai tahun lalu.
  const tahunAjaranSekarang = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  const [mode, setMode] = useState<Mode>('bulanan');
  const [tahun, setTahun] = useState(now.getFullYear());
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahunAjaranAwal, setTahunAjaranAwal] = useState(tahunAjaranSekarang);
  const [semester, setSemester] = useState<1 | 2>(now.getMonth() + 1 >= 7 ? 1 : 2);
  const [kustomTahun, setKustomTahun] = useState(now.getFullYear());
  const [kustomMulai, setKustomMulai] = useState(1);
  const [kustomAkhir, setKustomAkhir] = useState(6);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  // Query params efektif berdasarkan mode yang dipilih.
  function queryParams() {
    if (mode === 'semester') {
      if (semester === 1) return { tahun: tahunAjaranAwal, bulan_mulai: 7, bulan_akhir: 12 };
      return { tahun: tahunAjaranAwal + 1, bulan_mulai: 1, bulan_akhir: 6 };
    }
    if (mode === 'kustom') return { tahun: kustomTahun, bulan_mulai: kustomMulai, bulan_akhir: kustomAkhir };
    return { tahun, bulan };
  }

  function periodeLabelDisplay() {
    if (mode === 'semester') {
      return semester === 1
        ? `Semester Ganjil ${tahunAjaranAwal}/${tahunAjaranAwal + 1} (Juli–Desember ${tahunAjaranAwal})`
        : `Semester Genap ${tahunAjaranAwal}/${tahunAjaranAwal + 1} (Januari–Juni ${tahunAjaranAwal + 1})`;
    }
    if (mode === 'kustom') return `${BULAN_NAMA[kustomMulai]}–${BULAN_NAMA[kustomAkhir]} ${kustomTahun}`;
    return `${BULAN_NAMA[bulan]} ${tahun}`;
  }

  function filenameSuffix() {
    if (mode === 'semester') return `Semester-${semester === 1 ? 'Ganjil' : 'Genap'}-${tahunAjaranAwal}-${tahunAjaranAwal + 1}`;
    if (mode === 'kustom') return `${BULAN_NAMA[kustomMulai]}-${BULAN_NAMA[kustomAkhir]}-${kustomTahun}`;
    return `${BULAN_NAMA[bulan]}-${tahun}`;
  }

  function load() {
    setLoading(true); setError('');
    const p = queryParams();
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])));
    api.get(`/rekap?${qs.toString()}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [mode, tahun, bulan, tahunAjaranAwal, semester, kustomTahun, kustomMulai, kustomAkhir]);

  function periodeMeta() {
    const periodeLabel = periodeLabelDisplay();
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
    XLSX.writeFile(wb, `Laporan-${filenameSuffix()}.xlsx`);
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
      await downloadPdfSingle(html, `Rapor-${d.nama}-${filenameSuffix()}.pdf`);
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
      await downloadPdfBundle(htmls, `Rapor-Sekelas-${filenameSuffix()}.pdf`, (i, total) => {
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
      <h1 className="tf-title">Rekap & Rapor</h1>
      {error && <div className="tf-error">{error}</div>}
      {pdfBusy && <div className="tf-empty">⏳ {pdfBusy}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-tabs" style={{ marginBottom: 14 }}>
            <button className={`tf-tab ${mode === 'bulanan' ? 'active' : ''}`} onClick={() => setMode('bulanan')}>📅 Bulanan</button>
            <button className={`tf-tab ${mode === 'semester' ? 'active' : ''}`} onClick={() => setMode('semester')}>🎓 Semester</button>
            <button className={`tf-tab ${mode === 'kustom' ? 'active' : ''}`} onClick={() => setMode('kustom')}>🔧 Rentang Kustom</button>
          </div>

          {mode === 'bulanan' && (
            <>
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
            </>
          )}

          {mode === 'semester' && (
            <>
              <div className="tf-field">
                <label>Tahun Ajaran</label>
                <select value={tahunAjaranAwal} onChange={(e) => setTahunAjaranAwal(Number(e.target.value))}>
                  {Array.from({ length: 6 }, (_, i) => tahunAjaranSekarang - 3 + i).map((ta) => (
                    <option key={ta} value={ta}>{ta}/{ta + 1}</option>
                  ))}
                </select>
              </div>
              <div className="tf-field">
                <label>Semester</label>
                <select value={semester} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}>
                  <option value={1}>Ganjil (Juli–Desember)</option>
                  <option value={2}>Genap (Januari–Juni)</option>
                </select>
              </div>
            </>
          )}

          {mode === 'kustom' && (
            <>
              <div className="tf-field">
                <label>Tahun</label>
                <input type="number" value={kustomTahun} onChange={(e) => setKustomTahun(Number(e.target.value))} />
              </div>
              <div className="tf-field">
                <label>Dari Bulan</label>
                <select value={kustomMulai} onChange={(e) => setKustomMulai(Number(e.target.value))}>
                  {BULAN_NAMA.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                </select>
              </div>
              <div className="tf-field">
                <label>Sampai Bulan</label>
                <select value={kustomAkhir} onChange={(e) => setKustomAkhir(Number(e.target.value))}>
                  {BULAN_NAMA.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                </select>
              </div>
              <div className="tf-empty" style={{ width: '100%' }}>
                Catatan: rentang kustom hanya untuk bulan-bulan dalam tahun kalender yang sama (belum mendukung lintas tahun, mis. Nov–Feb).
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? <div className="tf-empty">Memuat...</div> : data && (
        <div className="tf-panel">
          <div className="tf-panel-head" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Rapor {periodeLabelDisplay()} — Tahun Ajaran {data.tahun_ajaran} (Semester {data.semester})</span>
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
