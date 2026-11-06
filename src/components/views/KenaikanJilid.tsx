'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { useSortable } from '@/lib/use-sortable';
import Modal from '../Modal';
import type { User } from '../AppShell';

const STATUS_LABEL: Record<string, { t: string; bg: string; fg: string }> = {
  siap: { t: '✅ Siap ujian', bg: '#dcfce7', fg: '#15803d' },
  diajukan: { t: '⏳ Menunggu ujian', bg: '#fef3c7', fg: '#b45309' },
  belum: { t: 'Belum siap', bg: '#f1f5f9', fg: '#475569' },
  manual: { t: 'Dicatat manual', bg: '#e0f2fe', fg: '#0369a1' },
  khatam: { t: '🎓 Khatam Ummi', bg: '#f3e8ff', fg: '#7c3aed' },
};
const HASIL_LABEL: Record<string, string> = { lulus: 'Lulus', belum_lulus: 'Belum lulus', diajukan: 'Menunggu ujian', dibatalkan: 'Dibatalkan' };

export default function KenaikanJilidView({ user }: { user: User }) {
  const isAdmin = user.role === 'admin';
  const canAjukan = user.role === 'admin' || user.role === 'penyimak';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'semua' | 'siap' | 'diajukan' | 'belum'>('semua');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<any | null>(null); // { mode: 'hasil'|'catat', siswa, pengajuan_id? }
  const [form, setForm] = useState({ hasil: 'lulus', tanggal_ujian: '', penguji: '', nilai_ujian: '', catatan: '' });
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get('/kenaikan-jilid').then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const rows = (data?.siswa || []).filter((s: any) => {
    if (search && !s.nama.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'semua') return true;
    return s.status === filter;
  }).map((s: any) => ({ ...s, halaman_txt: s.halaman_terakhir ?? '', status_txt: STATUS_LABEL[s.status]?.t || s.status }));
  const { sorted, Th } = useSortable(rows);

  async function aksi(body: any, pesan: string) {
    setError(''); setBusy(true);
    try { const r = await api.post('/kenaikan-jilid', body); showToast(pesan); setModal(null); load(); return r; }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function bukaModal(mode: 'hasil' | 'catat', s: any) {
    setForm({ hasil: 'lulus', tanggal_ujian: new Date().toISOString().slice(0, 10), penguji: user.nama || '', nilai_ujian: '', catatan: '' });
    setModal({ mode, siswa: s });
  }
  async function simpanHasil() {
    if (!modal) return;
    const base = { hasil: form.hasil, tanggal_ujian: form.tanggal_ujian, penguji: form.penguji, nilai_ujian: form.nilai_ujian, catatan: form.catatan };
    const body = modal.mode === 'hasil' ? { action: 'hasil', id: modal.siswa.pengajuan_id, ...base } : { action: 'catat', santri_id: modal.siswa.id, ...base };
    const r = await aksi(body, form.hasil === 'lulus' ? `${modal.siswa.nama} naik ke ${modal.siswa.ke_jilid}` : 'Hasil ujian tersimpan (belum lulus)');
    return r;
  }

  const ringkas = data?.ringkas || { siap: 0, diajukan: 0 };

  return (
    <div>
      <h1 className="tf-title">Kenaikan Jilid Ummi</h1>
      {error && <div className="tf-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {loading && <div className="tf-empty">Memuat...</div>}

      {data && (
        <>
          <div className="tf-stats">
            <div className="tf-stat-card c-green"><div className="label">Siap Ujian</div><div className="value">{ringkas.siap}</div></div>
            <div className="tf-stat-card c-gold"><div className="label">Menunggu Ujian</div><div className="value">{ringkas.diajukan}</div></div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Status Siswa</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Siswa <b>siap ujian</b> bila sudah mencapai halaman terakhir jilidnya (nilai ≥ {data.pengaturan.syarat_ujian.nilai_halaman_akhir}) dan rata-rata
                {' '}{data.pengaturan.syarat_ujian.jumlah_setoran} setoran Ummi terakhir ≥ {data.pengaturan.syarat_ujian.rata_min}. Guru mengajukan ujian, admin mencatat hasil dan mengesahkan kenaikan.
                {isAdmin && ' Syarat dan jumlah halaman tiap jilid diatur di menu Pengaturan Penilaian.'}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                {([['semua', 'Semua'], ['siap', 'Siap ujian'], ['diajukan', 'Menunggu ujian'], ['belum', 'Belum siap']] as const).map(([k, l]) => (
                  <button key={k} className={filter === k ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={() => setFilter(k)}>{l}</button>
                ))}
                <input placeholder="Cari nama siswa..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 8 }} />
              </div>
              {sorted.length === 0 ? <div className="tf-empty">Tidak ada siswa yang cocok.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tf-table">
                    <thead>
                      <tr>
                        <th>#</th><Th sortk="nama" label="Nama" /><Th sortk="kelas_nama" label="Kelas" /><Th sortk="level" label="Level" />
                        <Th sortk="halaman_txt" label="Halaman" /><Th sortk="rata_nilai" label="Rata-rata" /><th>Syarat</th><Th sortk="status_txt" label="Status" />
                        {canAjukan && <th>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((s: any, i: number) => {
                        const st = STATUS_LABEL[s.status];
                        return (
                          <tr key={s.id}>
                            <td>{i + 1}</td>
                            <td>{s.nama}</td><td>{s.kelas_nama}</td><td>{s.level}</td>
                            <td>{s.halaman_akhir_jilid ? `${s.halaman_terakhir ?? '-'} / ${s.halaman_akhir_jilid}` : '-'}</td>
                            <td>{s.rata_nilai ?? '-'}</td>
                            <td style={{ fontSize: 12 }}>{s.halaman_akhir_jilid ? <>{s.syarat_halaman ? '✓' : '✗'} halaman · {s.syarat_nilai ? '✓' : '✗'} nilai</> : '-'}</td>
                            <td>
                              <span className="tf-badge" style={{ background: st.bg, color: st.fg }}>{st.t}</span>
                              {s.ujian_gagal > 0 && <div className="tf-muted">belum lulus {s.ujian_gagal}×</div>}
                            </td>
                            {canAjukan && (
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {s.status === 'siap' && <button className="tf-btn-sm" disabled={busy} onClick={() => aksi({ action: 'ajukan', santri_id: s.id }, 'Pengajuan ujian dibuat')}>Ajukan ujian</button>}
                                {s.status === 'diajukan' && isAdmin && <button className="tf-btn-sm tf-btn" onClick={() => bukaModal('hasil', s)}>Catat hasil</button>}
                                {s.status === 'diajukan' && <button className="tf-btn-sm" disabled={busy} onClick={() => confirm(`Batalkan pengajuan ujian ${s.nama}?`) && aksi({ action: 'batal', id: s.pengajuan_id }, 'Pengajuan dibatalkan')} style={{ marginLeft: 4 }}>Batal</button>}
                                {isAdmin && s.status !== 'diajukan' && s.status !== 'khatam' && s.ke_jilid && (
                                  <button className="tf-btn-sm" onClick={() => bukaModal('catat', s)} title="Catat ujian tanpa pengajuan">Catat ujian</button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Riwayat Kenaikan Jilid</div>
            <div className="tf-panel-body">
              {data.riwayat.length === 0 ? <div className="tf-empty">Belum ada riwayat.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tf-table">
                    <thead><tr><th>Tanggal</th><th>Siswa</th><th>Kelas</th><th>Jilid</th><th>Hasil</th><th>Nilai</th><th>Penguji</th><th>Catatan</th>{isAdmin && <th>Aksi</th>}</tr></thead>
                    <tbody>
                      {data.riwayat.map((r: any) => (
                        <tr key={r.id} style={r.status === 'dibatalkan' ? { opacity: 0.5 } : undefined}>
                          <td>{String(r.tanggal_ujian || r.diajukan_pada).substring(0, 10)}</td>
                          <td>{r.nama_siswa}</td><td>{r.kelas_nama}</td>
                          <td>{r.dari_jilid} → {r.ke_jilid}</td>
                          <td><b style={{ color: r.status === 'lulus' ? '#15803d' : r.status === 'belum_lulus' ? '#b91c1c' : undefined }}>{HASIL_LABEL[r.status] || r.status}</b></td>
                          <td>{r.nilai_ujian ?? '-'}</td>
                          <td>{r.penguji || '-'}</td>
                          <td>{r.catatan || ''}</td>
                          {isAdmin && (
                            <td>
                              {r.status === 'lulus' && (
                                <button className="tf-btn-sm" disabled={busy} onClick={() => confirm(`Batalkan kenaikan ${r.nama_siswa} (${r.dari_jilid} → ${r.ke_jilid})?\nLevel siswa dikembalikan ke ${r.dari_jilid}.`) && aksi({ action: 'batalkan_kenaikan', id: r.id }, 'Kenaikan dibatalkan')}>Batalkan</button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <h3 style={{ marginTop: 0 }}>Hasil Ujian — {modal.siswa.nama}</h3>
          <p className="tf-empty" style={{ textAlign: 'left' }}>{modal.siswa.level} → {modal.siswa.ke_jilid}</p>
          <div className="tf-field">
            <label>Hasil</label>
            <select value={form.hasil} onChange={(e) => setForm({ ...form, hasil: e.target.value })}>
              <option value="lulus">Lulus (naik ke {modal.siswa.ke_jilid})</option>
              <option value="belum_lulus">Belum lulus (tetap di {modal.siswa.level})</option>
            </select>
          </div>
          <div className="tf-field"><label>Tanggal ujian</label><input type="date" value={form.tanggal_ujian} onChange={(e) => setForm({ ...form, tanggal_ujian: e.target.value })} /></div>
          <div className="tf-field"><label>Penguji</label><input value={form.penguji} onChange={(e) => setForm({ ...form, penguji: e.target.value })} /></div>
          <div className="tf-field"><label>Nilai ujian (opsional, 0–100)</label><input type="number" min={0} max={100} value={form.nilai_ujian} onChange={(e) => setForm({ ...form, nilai_ujian: e.target.value })} /></div>
          <div className="tf-field"><label>Catatan (opsional)</label><input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
          {form.hasil === 'lulus' && <p className="tf-empty" style={{ textAlign: 'left' }}>Level siswa akan otomatis berubah menjadi <b>{modal.siswa.ke_jilid}</b> dan halaman dihitung mulai dari awal jilid baru. Setoran lama tidak dihapus.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tf-btn" disabled={busy} onClick={simpanHasil}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
            <button className="tf-btn-sm" onClick={() => setModal(null)}>Batal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
