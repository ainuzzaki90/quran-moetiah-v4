'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api-client';
import { AKSI_LABEL } from '@/lib/audit-label';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';

const GRUP: { v: string; l: string }[] = [
  { v: '', l: 'Semua aksi' },
  { v: 'setoran.*', l: 'Setoran (semua)' },
  { v: 'setoran.tambah', l: 'Setoran ditambah' },
  { v: 'setoran.ubah', l: 'Setoran diubah' },
  { v: 'setoran.hapus', l: 'Setoran dihapus' },
  { v: 'kenaikan.*', l: 'Kenaikan jilid' },
  { v: 'pengaturan.*', l: 'Pengaturan penilaian' },
  { v: 'pengguna.*', l: 'Akun pengguna' },
];

function waktuWIB(iso: string) {
  try {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  } catch { return iso; }
}

export default function AuditLogView() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [perHal, setPerHal] = useState(50);
  const [pelaku, setPelaku] = useState<{ id: number; nama: string }[]>([]);
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ dari: '', sampai: '', user_id: '', aksi: '', q: '' });
  const [applied, setApplied] = useState(f);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any | null>(null);

  function params(extra: Record<string, string> = {}) {
    const u = new URLSearchParams();
    Object.entries({ ...applied, ...extra }).forEach(([k, v]) => { if (v) u.set(k, String(v)); });
    return u.toString();
  }

  useEffect(() => {
    setLoading(true); setError('');
    api.get(`/audit-log?${params({ page: String(page) })}`)
      .then((r) => { setRows(r.data); setTotal(r.total); setPerHal(r.per_halaman); setPelaku(r.pelaku || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, page]);

  function terapkan() { setPage(1); setApplied(f); }
  function reset() { const k = { dari: '', sampai: '', user_id: '', aksi: '', q: '' }; setF(k); setPage(1); setApplied(k); }

  async function ekspor() {
    try {
      const r = await api.get(`/audit-log?${params({ semua: '1' })}`);
      const data = (r.data as any[]).map((x) => ({
        Waktu: waktuWIB(x.created_at), Pelaku: x.user_nama || '-', Peran: x.user_role || '-',
        Aksi: AKSI_LABEL[x.aksi] || x.aksi, Siswa: x.santri_nama || '', Ringkasan: x.ringkasan || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      XLSX.writeFile(wb, 'Audit-Log.xlsx');
      showToast(`${data.length} baris diekspor${r.total > data.length ? ` (dari ${r.total}, maksimal 5000)` : ''}`);
    } catch (e: any) { setError(e.message); }
  }

  const totalHal = Math.max(1, Math.ceil(total / perHal));
  const kunciDetail = detail ? Array.from(new Set([...Object.keys(detail.sebelum || {}), ...Object.keys(detail.sesudah || {})])) : [];
  const fmt = (v: any) => (v === null || v === undefined || v === '' ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v));

  return (
    <div>
      <h1 className="tf-title">Audit Log</h1>
      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            Jejak perubahan: setoran (tambah/ubah/hapus), kenaikan jilid, pengaturan penilaian, dan akun pengguna. Hanya admin yang dapat melihat. Catatan lebih dari 12 bulan dihapus otomatis.
          </div>
          <div className="tf-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 10 }}>
            <div className="tf-field"><label>Dari tanggal</label><input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} /></div>
            <div className="tf-field"><label>Sampai tanggal</label><input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} /></div>
            <div className="tf-field"><label>Pelaku</label>
              <select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
                <option value="">Semua</option>
                {pelaku.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="tf-field"><label>Jenis aksi</label>
              <select value={f.aksi} onChange={(e) => setF({ ...f, aksi: e.target.value })}>
                {GRUP.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
              </select>
            </div>
            <div className="tf-field"><label>Cari (siswa / isi)</label>
              <input value={f.q} placeholder="mis. nama siswa" onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') terapkan(); }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="tf-btn tf-btn-sm" style={{ width: 'auto' }} onClick={terapkan}>Terapkan filter</button>
            <button className="tf-btn-sm" style={{ width: 'auto' }} onClick={reset}>Reset</button>
            <button className="tf-btn-sm" style={{ width: 'auto' }} onClick={ekspor}>⬇ Ekspor Excel</button>
          </div>
        </div>
      </div>

      {error && <div className="tf-error">{error}</div>}
      <div className="tf-panel">
        <div className="tf-panel-head">Riwayat ({total})</div>
        <div className="tf-panel-body">
          {loading ? <div className="tf-empty">Memuat…</div> : rows.length === 0 ? <div className="tf-empty">Belum ada catatan untuk filter ini.</div> : (
            <div className="tf-table-wrap">
              <table className="tf-table">
                <thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Siswa</th><th>Ringkasan</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{waktuWIB(r.created_at)}</td>
                      <td>{r.user_nama || '-'}</td>
                      <td>{AKSI_LABEL[r.aksi] || r.aksi}</td>
                      <td>{r.santri_nama || '-'}</td>
                      <td style={{ maxWidth: 380 }}>{r.ringkasan || '-'}</td>
                      <td>{(r.sebelum || r.sesudah) && <button className="tf-btn-sm" style={{ width: 'auto' }} onClick={() => setDetail(r)}>Detail</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > perHal && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
              <button className="tf-btn-sm" style={{ width: 'auto' }} disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Sebelumnya</button>
              <span style={{ fontSize: 13 }}>Halaman {page} / {totalHal}</span>
              <button className="tf-btn-sm" style={{ width: 'auto' }} disabled={page >= totalHal} onClick={() => setPage(page + 1)}>Berikutnya ›</button>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <h3>{AKSI_LABEL[detail.aksi] || detail.aksi}</h3>
          <div style={{ fontSize: 13, marginBottom: 10 }}>{waktuWIB(detail.created_at)} · {detail.user_nama || '-'}{detail.santri_nama ? ` · ${detail.santri_nama}` : ''}</div>
          {kunciDetail.length === 0 ? <div className="tf-empty">Tidak ada rincian.</div> : (
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              {kunciDetail.map((k) => (
                <div key={k} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px dashed var(--border)', paddingBottom: 4 }}>
                  <b style={{ minWidth: 120 }}>{k}</b>
                  {detail.sebelum && k in detail.sebelum && <span style={{ textDecoration: detail.sesudah && k in detail.sesudah ? 'line-through' : 'none', opacity: .75 }}>{fmt(detail.sebelum[k])}</span>}
                  {detail.sesudah && k in detail.sesudah && <span>{detail.sebelum && k in detail.sebelum ? '→ ' : ''}{fmt(detail.sesudah[k])}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="tf-modal-actions"><button className="tf-btn-secondary" onClick={() => setDetail(null)}>Tutup</button></div>
        </Modal>
      )}
    </div>
  );
}
