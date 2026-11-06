'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { useSortable } from '@/lib/use-sortable';
import Modal from '../Modal';
import type { User } from '../AppShell';

const STATUS_LABEL: Record<string, { t: string; bg: string; fg: string }> = {
  siap: { t: '✅ Siap ujian', bg: '#dcfce7', fg: '#15803d' },
  belum: { t: 'Belum siap', bg: '#f1f5f9', fg: '#475569' },
  manual: { t: 'Dicatat manual', bg: '#e0f2fe', fg: '#0369a1' },
  khatam: { t: '🎓 Khatam Ummi', bg: '#f3e8ff', fg: '#7c3aed' },
};
const HASIL_LABEL: Record<string, string> = { lulus: 'Lulus', belum_lulus: 'Belum lulus', diajukan: 'Menunggu ujian (lama)', dibatalkan: 'Dibatalkan' };

export default function KenaikanJilidView({ user }: { user: User }) {
  const isAdmin = user.role === 'admin';
  const canAjukan = user.role === 'admin' || user.role === 'penyimak';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'semua' | 'siap' | 'belum'>('semua');
  const [search, setSearch] = useState('');
  const [kelasF, setKelasF] = useState('semua');
  const [levelF, setLevelF] = useState('semua');
  const [hanyaBinaan, setHanyaBinaan] = useState(user.role === 'penyimak');
  const [modal, setModal] = useState<any | null>(null); // { siswa }
  const [form, setForm] = useState({ hasil: 'lulus', tanggal_ujian: '', penguji: '', nilai_ujian: '', catatan: '' });
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get('/kenaikan-jilid').then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const rows = (data?.siswa || []).filter((s: any) => {
    if (search && !s.nama.toLowerCase().includes(search.toLowerCase())) return false;
    if (kelasF !== 'semua' && s.kelas_nama !== kelasF) return false;
    if (levelF !== 'semua' && s.level !== levelF) return false;
    if (user.role === 'penyimak' && hanyaBinaan && !s.binaan_saya) return false;
    if (filter === 'semua') return true;
    return s.status === filter;
  }).map((s: any) => {
    const o: any = { ...s, halaman_txt: s.halaman_terakhir ?? '', status_txt: STATUS_LABEL[s.status]?.t || s.status };
    (data?.halaqah || []).forEach((h: any) => { o[`guru_h_${h.id}`] = s.guru_halaqah?.[h.id] || ''; });
    return o;
  });
  const daftarKelas: string[] = Array.from(new Set<string>((data?.siswa || []).map((s: any) => s.kelas_nama))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  const daftarLevel: string[] = Array.from(new Set<string>((data?.siswa || []).map((s: any) => s.level)));
  const { sorted, Th } = useSortable(rows);

  async function aksi(body: any, pesan: string) {
    setError(''); setBusy(true);
    try { const r = await api.post('/kenaikan-jilid', body); showToast(pesan); setModal(null); load(); return r; }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function bukaModal(s: any) {
    setForm({ hasil: 'lulus', tanggal_ujian: new Date().toISOString().slice(0, 10), penguji: user.nama || '', nilai_ujian: '', catatan: '' });
    setModal({ siswa: s });
  }
  async function simpanHasil() {
    if (!modal) return;
    const s = modal.siswa;
    const pesanKonfirmasi = form.hasil === 'lulus'
      ? `${s.nama} dinyatakan LULUS dan naik dari ${s.level} ke ${s.ke_jilid}.\n\nLanjutkan?`
      : `${s.nama} dinyatakan BELUM LULUS dan tetap di ${s.level}.\n\nLanjutkan?`;
    if (!confirm(pesanKonfirmasi)) return;
    await aksi(
      { action: 'catat', santri_id: s.id, dari_jilid: s.level, hasil: form.hasil, tanggal_ujian: form.tanggal_ujian, penguji: form.penguji, nilai_ujian: form.nilai_ujian, catatan: form.catatan },
      form.hasil === 'lulus' ? `${s.nama} naik ke ${s.ke_jilid}` : 'Hasil ujian tersimpan (belum lulus)',
    );
  }

  const ringkas = data?.ringkas || { siap: 0 };

  return (
    <div>
      <h1 className="tf-title">Kenaikan Jilid Ummi</h1>
      {error && <div className="tf-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {loading && <div className="tf-empty">Memuat...</div>}

      {data && (
        <>
          <div className="tf-stats">
            <div className="tf-stat-card c-green"><div className="label">Siap Ujian</div><div className="value">{ringkas.siap}</div></div>
          </div>

          <div className="tf-panel">
            <div className="tf-panel-head">Status Siswa</div>
            <div className="tf-panel-body">
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Siswa <b>siap ujian</b> bila sudah mencapai halaman terakhir jilidnya (nilai ≥ {data.pengaturan.syarat_ujian.nilai_halaman_akhir}) dan rata-rata
                {' '}{data.pengaturan.syarat_ujian.jumlah_setoran} setoran Ummi terakhir ≥ {data.pengaturan.syarat_ujian.rata_min}. <b>Semua guru boleh menguji dan mencatat hasil ujian</b> siswa yang siap; bila lulus, jilid siswa naik otomatis.
                {isAdmin && ' Syarat dan jumlah halaman tiap jilid diatur di menu Pengaturan Penilaian.'}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                {([['semua', 'Semua'], ['siap', 'Siap ujian'], ['belum', 'Belum siap']] as const).map(([k, l]) => (
                  <button key={k} className={filter === k ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={() => setFilter(k)}>{l}</button>
                ))}
                <input placeholder="Cari nama siswa..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 8 }} />
                <select value={kelasF} onChange={(e) => setKelasF(e.target.value)} style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <option value="semua">Semua kelas</option>{daftarKelas.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select value={levelF} onChange={(e) => setLevelF(e.target.value)} style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <option value="semua">Semua level</option>{daftarLevel.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {user.role === 'penyimak' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={hanyaBinaan} onChange={(e) => setHanyaBinaan(e.target.checked)} /> Hanya binaan saya
                  </label>
                )}
              </div>
              {sorted.length === 0 ? <div className="tf-empty">Tidak ada siswa yang cocok.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tf-table">
                    <thead>
                      <tr>
                        <th>#</th><Th sortk="nama" label="Nama" /><Th sortk="kelas_nama" label="Kelas" /><Th sortk="level" label="Level" />
                        {(data.halaqah || []).map((h: any) => <Th key={h.id} sortk={`guru_h_${h.id}`} label={`Guru ${h.nama}`} />)}<Th sortk="halaman_txt" label="Halaman" /><Th sortk="rata_nilai" label="Rata-rata" /><th>Syarat</th><Th sortk="status_txt" label="Status" />
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
                            {(data.halaqah || []).map((h: any) => <td key={h.id} style={{ fontSize: 12.5 }}>{s.guru_halaqah?.[h.id] || '-'}</td>)}
                            <td>{s.halaman_akhir_jilid ? `${s.halaman_terakhir ?? '-'} / ${s.halaman_akhir_jilid}` : '-'}</td>
                            <td>{s.rata_nilai ?? '-'}</td>
                            <td style={{ fontSize: 12 }}>{s.halaman_akhir_jilid ? <>{s.syarat_halaman ? '✓' : '✗'} halaman · {s.syarat_nilai ? '✓' : '✗'} nilai</> : '-'}</td>
                            <td>
                              <span className="tf-badge" style={{ background: st.bg, color: st.fg }}>{st.t}</span>
                              {s.ujian_gagal > 0 && <div className="tf-muted">belum lulus {s.ujian_gagal}×</div>}
                            </td>
                            {canAjukan && (
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {s.status === 'siap' && <button className="tf-btn-sm tf-btn" onClick={() => bukaModal(s)}>Catat hasil ujian</button>}
                                {isAdmin && s.status !== 'siap' && s.status !== 'khatam' && s.ke_jilid && (
                                  <button className="tf-btn-sm" onClick={() => bukaModal(s)} title="Catat ujian walau belum memenuhi syarat (admin)">Catat ujian</button>
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
                    <thead><tr><th>Tanggal</th><th>Siswa</th><th>Kelas</th><th>Jilid</th><th>Hasil</th><th>Nilai</th><th>Penguji</th><th>Dicatat oleh</th><th>Catatan</th>{canAjukan && <th>Aksi</th>}</tr></thead>
                    <tbody>
                      {data.riwayat.map((r: any) => (
                        <tr key={r.id} style={r.status === 'dibatalkan' ? { opacity: 0.5 } : undefined}>
                          <td>{String(r.tanggal_ujian || r.diajukan_pada).substring(0, 10)}</td>
                          <td>{r.nama_siswa}</td><td>{r.kelas_nama}</td>
                          <td>{r.dari_jilid} → {r.ke_jilid}</td>
                          <td><b style={{ color: r.status === 'lulus' ? '#15803d' : r.status === 'belum_lulus' ? '#b91c1c' : undefined }}>{HASIL_LABEL[r.status] || r.status}</b></td>
                          <td>{r.nilai_ujian ?? '-'}</td>
                          <td>{r.penguji || '-'}</td>
                          <td>{r.dicatat_oleh_nama}</td>
                          <td>{r.catatan || ''}</td>
                          {canAjukan && (
                            <td>
                              {r.bisa_batal && (
                                <button className="tf-btn-sm" disabled={busy} onClick={() => confirm(r.status === 'lulus' ? `Batalkan kenaikan ${r.nama_siswa} (${r.dari_jilid} → ${r.ke_jilid})?\nLevel siswa dikembalikan ke ${r.dari_jilid}.` : `Batalkan catatan "belum lulus" ${r.nama_siswa}?`) && aksi({ action: 'batalkan_kenaikan', id: r.id }, 'Catatan dibatalkan')}>Batalkan</button>
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
          {!isAdmin && <p className="tf-empty" style={{ textAlign: 'left' }}>Catatan ini bisa Anda batalkan dalam 24 jam; setelah itu hanya admin.</p>}
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
