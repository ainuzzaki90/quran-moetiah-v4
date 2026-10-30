'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useHalaqah, halaqahLabel } from '../HalaqahSelect';
import { SURAH_PAGES } from '@/lib/surah-pages';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';
import type { User } from '../AppShell';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function StatistikView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [periode, setPeriode] = useState('bulanan');
  const [tanggalRef, setTanggalRef] = useState(new Date().toISOString().substring(0, 10));
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().substring(0, 10));
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().substring(0, 10));
  const { list: halaqahList } = useHalaqah();
  const [halaqahId, setHalaqahId] = useState('semua');
  const [santriId, setSantriId] = useState('all');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  type SortKey = 'urut_hafalan' | 'total_poin' | 'total_ayat_hafal' | 'surat_hafal' | 'rata_nilai' | 'total_setoran' | 'nama' | 'kelas_nama';
  const [sortBy, setSortBy] = useState<SortKey>('urut_hafalan');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const canEditAwal = user.role === 'admin' || user.role === 'penyimak';

  // ---- Hafalan awal ----
  const [awalFor, setAwalFor] = useState<any | null>(null);
  const [awalSet, setAwalSet] = useState<Set<number>>(new Set());
  async function bukaAwal(d: any) {
    try {
      const res = await api.get(`/hafalan-awal?santri_id=${d.santri_id}`);
      setAwalSet(new Set<number>(res.data));
      setAwalFor(d);
    } catch (e: any) { setError(e.message); }
  }
  function isiBerurutan(sampaiNo: number) {
    const s = new Set<number>(awalSet);
    for (let n = 114; n >= sampaiNo; n--) s.add(n);
    setAwalSet(s);
  }
  async function simpanAwal() {
    try {
      await api.post('/hafalan-awal', { santri_id: awalFor.santri_id, surah_list: Array.from(awalSet) });
      showToast('Hafalan awal berhasil disimpan');
      setAwalFor(null);
      loadStatistik();
    } catch (e: any) { setError(e.message); }
  }
  function klikHeader(k: SortKey) {
    if (sortBy === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(k); setSortDir(k === 'nama' || k === 'kelas_nama' ? 'asc' : 'desc'); }
  }
  const arrow = (k: SortKey) => (sortBy === k ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '');

  useEffect(() => {
    api.get('/santri').then((res) => setSantriList(res.data)).catch((e) => setError(e.message));
  }, []);

  function loadStatistik() {
    setLoading(true); setError('');
    const params = new URLSearchParams({ periode, santri_id: santriId, halaqah_id: halaqahId });
    if (periode === 'tentatif') {
      params.set('tanggal_mulai', tanggalMulai);
      params.set('tanggal_selesai', tanggalSelesai);
    } else {
      params.set('tanggal_referensi', tanggalRef);
    }
    api.get(`/statistik?${params.toString()}`)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(loadStatistik, []);

  // urut_hafalan = urutan menghafal tradisional: surat berurutan dari An-Nas terbanyak,
  // lalu total ayat hafal, lalu rata-rata nilai.
  const peringkatSorted = data ? [...(data.peringkat || [])].sort((a: any, b: any) => {
    let r = 0;
    if (sortBy === 'urut_hafalan') {
      r = (a.surat_berurutan - b.surat_berurutan) || (a.total_ayat_hafal - b.total_ayat_hafal) || (a.rata_nilai - b.rata_nilai);
    } else if (sortBy === 'nama' || sortBy === 'kelas_nama') {
      r = String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), 'id');
    } else {
      r = (a[sortBy] || 0) - (b[sortBy] || 0);
    }
    return sortDir === 'desc' ? -r : r;
  }) : [];
  const days = data ? Object.keys(data.per_hari || {}).sort() : [];
  const maxCount = Math.max(1, ...days.map((d) => data.per_hari[d]));

  return (
    <div>
      <h1 className="tf-title">Statistik Setoran</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-body">
          <div className="tf-stat-filter">
            <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="harian">Harian</option>
              <option value="pekanan">Pekanan (Mingguan)</option>
              <option value="bulanan">Bulanan</option>
              <option value="tentatif">Tentatif (Rentang Tanggal)</option>
            </select>
            {periode !== 'tentatif' ? (
              <input type="date" value={tanggalRef} onChange={(e) => setTanggalRef(e.target.value)} />
            ) : (
              <>
                <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
                <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
              </>
            )}
            <select value={santriId} onChange={(e) => setSantriId(e.target.value)}>
              <option value="all">Semua Siswa</option>
              {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
            <select value={halaqahId} onChange={(e) => setHalaqahId(e.target.value)}>
              <option value="semua">Semua Halaqah</option>
              {halaqahList.map((h) => <option key={h.id} value={h.id}>{halaqahLabel(h)}</option>)}
            </select>
            <button className="tf-btn-sm" onClick={loadStatistik}>Tampilkan</button>
          </div>

          {loading ? <div className="tf-empty">Memuat...</div> : !data ? (
            <div className="tf-empty">Pilih filter lalu klik Tampilkan.</div>
          ) : (
            <>
              <div className="tf-stats">
                <div className="tf-stat-card c-cyan"><div className="label">TOTAL SETORAN</div><div className="value">{data.total_setoran}</div></div>
                <div className="tf-stat-card c-red"><div className="label">RATA-RATA NILAI</div><div className="value">{data.rata_nilai.toFixed(2)}</div></div>
                <div className="tf-stat-card c-green"><div className="label">HAFALAN BARU</div><div className="value">{data.per_jenis['Hafalan Baru'] || 0}</div></div>
                <div className="tf-stat-card c-green2"><div className="label">MUROJAAH</div><div className="value">{data.per_jenis['Murojaah'] || 0}</div></div>
              </div>

              <h3 style={{ color: 'var(--heading)', fontSize: 15 }}>Grafik Setoran per Hari</h3>
              <div className="tf-bar-chart">
                {days.length === 0 ? <div className="tf-empty">Tidak ada data pada rentang ini.</div> : days.map((tgl) => (
                  <div className="tf-bar-row" key={tgl}>
                    <span className="tf-bar-label">{tgl}</span>
                    <div className="tf-bar-track"><div className="tf-bar-fill" style={{ width: `${(data.per_hari[tgl] / maxCount) * 100}%` }} /></div>
                    <span className="tf-bar-value">{data.per_hari[tgl]}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                <h3 style={{ color: 'var(--heading)', fontSize: 15, margin: 0 }}>🏆 Peringkat Capaian Siswa</h3>
                <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortKey); setSortDir('desc'); }}>
                  <option value="urut_hafalan">Urutkan: Hafalan Surat (An-Nas → ke atas)</option>
                  <option value="total_poin">Urutkan: Poin Prestasi Tertinggi</option>
                  <option value="total_ayat_hafal">Urutkan: Total Ayat Hafal Terbanyak</option>
                  <option value="surat_hafal">Urutkan: Jumlah Surat Hafal Terbanyak</option>
                  <option value="rata_nilai">Urutkan: Rata-rata Nilai Tertinggi</option>
                  <option value="total_setoran">Urutkan: Total Setoran Terbanyak</option>
                </select>
              </div>

              {peringkatSorted.length === 0 ? <div className="tf-empty">Tidak ada data siswa pada filter ini.</div> : (
                <div className="tf-table-wrap">
                  <table className="tf-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('nama')}>Nama{arrow('nama')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('kelas_nama')}>Kelas{arrow('kelas_nama')}</th>
                        <th>Level Ummi</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('urut_hafalan')}>Hafalan Berurutan (dari An-Nas){arrow('urut_hafalan')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('total_poin')}>Poin Prestasi{arrow('total_poin')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('surat_hafal')}>Surat Hafal{arrow('surat_hafal')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('total_ayat_hafal')}>Total Ayat Hafal{arrow('total_ayat_hafal')}</th>
                        <th>Halaman Terakhir</th><th>Surah Terakhir</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('total_setoran')}>Total Setoran{arrow('total_setoran')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => klikHeader('rata_nilai')}>Rata-rata Nilai{arrow('rata_nilai')}</th>
                        {canEditAwal && <th>Hafalan Awal</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {peringkatSorted.map((d: any, i: number) => (
                        <tr key={d.santri_id}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{MEDALS[i] || i + 1}</td>
                          <td>{d.nama}</td>
                          <td>{d.kelas_nama}</td>
                          <td>{d.level_ummi}</td>
                          <td style={{ fontWeight: sortBy === 'urut_hafalan' ? 700 : undefined }}>{d.surat_berurutan_label || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'total_poin' ? 700 : undefined }}>{d.total_poin} <span style={{ color: '#9ca3af', fontSize: 11 }}>({d.halaman_hafal} hlm)</span></td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'surat_hafal' ? 700 : undefined }}>{d.surat_hafal}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'total_ayat_hafal' ? 700 : undefined }}>{d.total_ayat_hafal}</td>
                          <td>{d.halaman_terakhir || '-'}</td>
                          <td>{d.surah_terakhir || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'total_setoran' ? 700 : undefined }}>{d.total_setoran}</td>
                          <td style={{ textAlign: 'center', fontWeight: sortBy === 'rata_nilai' ? 700 : undefined }}>{d.rata_nilai}</td>
                          {canEditAwal && <td><button className="tf-btn-sm" onClick={() => bukaAwal(d)}>✏️ Atur</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {awalFor && (
        <Modal onClose={() => setAwalFor(null)}>
          <h3>Hafalan Awal — {awalFor.nama}</h3>
          <p className="tf-empty" style={{ textAlign: 'left' }}>
            Hanya untuk kasus khusus. Hafalan siswa sudah dihitung <b>otomatis dari setoran Hafalan Baru</b> (nilai ≥ 75):
            surat terjauh yang disetor dianggap batas, dan semua surat dari An-Nas sampai batas itu dianggap hafal.
            Centang di sini bila ada surat yang perlu ditambahkan secara manual.
          </p>
          <div className="tf-field">
            <label>Isi cepat: hafal berurutan dari An-Nas sampai</label>
            <select value="" onChange={(e) => { if (e.target.value) isiBerurutan(Number(e.target.value)); }}>
              <option value="">-- pilih surat --</option>
              {[...SURAH_PAGES].reverse().map((s) => <option key={s[0]} value={s[0]}>{s[0]}. {s[1]}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 8 }}>
            {[...SURAH_PAGES].reverse().map((s) => (
              <label key={s[0]} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0' }}>
                <input
                  type="checkbox"
                  checked={awalSet.has(s[0])}
                  onChange={() => setAwalSet((prev) => { const n = new Set(prev); if (n.has(s[0])) n.delete(s[0]); else n.add(s[0]); return n; })}
                />
                {s[0]}. {s[1]} <span style={{ color: '#9ca3af', fontSize: 12 }}>({s[3]} ayat)</span>
              </label>
            ))}
          </div>
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setAwalSet(new Set())}>Kosongkan</button>
            <button className="tf-btn tf-btn-secondary" onClick={() => setAwalFor(null)}>Batal</button>
            <button className="tf-btn" onClick={simpanAwal}>Simpan</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
