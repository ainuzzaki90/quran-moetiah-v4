'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { UMMI_RUBRIK } from '@/lib/helpers';
import type { User } from '../AppShell';

const JENIS_OPTIONS = ['Setoran Metode Ummi', 'Hafalan Baru', 'Murojaah', 'Tilawah'];

export default function SetoranView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);

  const [tanggal, setTanggal] = useState(new Date().toISOString().substring(0, 10));
  const [santriId, setSantriId] = useState('');
  const [jenis, setJenis] = useState('Setoran Metode Ummi');
  const [halamanMulai, setHalamanMulai] = useState('');
  const [halamanSelesai, setHalamanSelesai] = useState('');
  const [surah, setSurah] = useState('');
  const [ayatMulai, setAyatMulai] = useState('');
  const [surahSelesai, setSurahSelesai] = useState('');
  const [ayatSelesai, setAyatSelesai] = useState('');
  const [rubrikKode, setRubrikKode] = useState('');
  const [nilai, setNilai] = useState<number | ''>('');
  const [catatan, setCatatan] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/santri?binaan_only=1'),
      api.get('/setoran'),
    ])
      .then(([s, r]) => { setSantriList(s.data); setRiwayat(r.data.slice(0, 20)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function pilihRubrik(kode: string) {
    setRubrikKode(kode);
    const r = UMMI_RUBRIK.find((x) => x.kode === kode);
    if (r) setNilai(r.nilai);
  }

  async function submit() {
    setError(''); setOk('');
    if (!santriId) { setError('Pilih santri terlebih dahulu'); return; }
    try {
      await api.post('/setoran', {
        tanggal, santri_id: Number(santriId), jenis,
        halaman_mulai: halamanMulai, halaman_selesai: halamanSelesai,
        surah, ayat_mulai: ayatMulai, surah_selesai: surahSelesai, ayat_selesai: ayatSelesai,
        nilai: nilai === '' ? null : Number(nilai), catatan,
      });
      setOk('Setoran berhasil disimpan.');
      setHalamanMulai(''); setHalamanSelesai(''); setSurah(''); setAyatMulai('');
      setSurahSelesai(''); setAyatSelesai(''); setRubrikKode(''); setNilai(''); setCatatan('');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number) {
    if (!confirm('Hapus setoran ini?')) return;
    try { await api.del(`/setoran/${id}`); load(); } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="tf-title">Input Setoran</h1>
      {error && <div className="tf-error">{error}</div>}
      {ok && <div className="tf-empty">{ok}</div>}

      <div className="tf-panel">
        <div className="tf-panel-head">Form Setoran</div>
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Tanggal</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="tf-field">
            <label>Santri</label>
            <select value={santriId} onChange={(e) => setSantriId(e.target.value)}>
              <option value="">- Pilih Santri -</option>
              {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>
          <div className="tf-field">
            <label>Jenis Setoran</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          {jenis === 'Setoran Metode Ummi' ? (
            <>
              <div className="tf-field">
                <label>Halaman Mulai</label>
                <input value={halamanMulai} onChange={(e) => setHalamanMulai(e.target.value)} />
              </div>
              <div className="tf-field">
                <label>Halaman Selesai</label>
                <input value={halamanSelesai} onChange={(e) => setHalamanSelesai(e.target.value)} />
              </div>
              <div className="tf-field">
                <label>Rubrik Penilaian</label>
                <select value={rubrikKode} onChange={(e) => pilihRubrik(e.target.value)}>
                  <option value="">- Pilih hasil bacaan -</option>
                  {UMMI_RUBRIK.map((r) => <option key={r.kode} value={r.kode}>{r.label}</option>)}
                </select>
                {rubrikKode && (
                  <div className="tf-empty" style={{ marginTop: 8 }}>
                    Status: {UMMI_RUBRIK.find((r) => r.kode === rubrikKode)?.status}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="tf-field">
                <label>Surah Mulai</label>
                <input value={surah} onChange={(e) => setSurah(e.target.value)} placeholder="Contoh: An-Naba" />
              </div>
              <div className="tf-field">
                <label>Ayat Mulai</label>
                <input value={ayatMulai} onChange={(e) => setAyatMulai(e.target.value)} />
              </div>
              <div className="tf-field">
                <label>Surah Selesai</label>
                <input value={surahSelesai} onChange={(e) => setSurahSelesai(e.target.value)} placeholder="Kosongkan jika sama" />
              </div>
              <div className="tf-field">
                <label>Ayat Selesai</label>
                <input value={ayatSelesai} onChange={(e) => setAyatSelesai(e.target.value)} />
              </div>
            </>
          )}

          <div className="tf-field">
            <label>Nilai (0-100)</label>
            <input type="number" min={0} max={100} value={nilai} onChange={(e) => setNilai(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div className="tf-field">
            <label>Catatan</label>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} />
          </div>

          <button className="tf-btn" onClick={submit}>Simpan Setoran</button>
        </div>
      </div>

      <div className="tf-panel">
        <div className="tf-panel-head">Riwayat Setoran Terbaru</div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : riwayat.length === 0 ? (
            <div className="tf-empty">Belum ada riwayat setoran.</div>
          ) : (
            <table className="tf-table">
              <thead><tr><th>Tanggal</th><th>Jenis</th><th>Detail</th><th>Nilai</th><th>Predikat</th><th>Aksi</th></tr></thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.tanggal).substring(0, 10)}</td>
                    <td>{r.jenis}</td>
                    <td>{r.jenis === 'Setoran Metode Ummi' ? `Hal. ${r.halaman_selesai || r.halaman_mulai || '-'}` : (r.surah_selesai || r.surah || '-')}</td>
                    <td>{r.nilai ?? '-'}</td>
                    <td>{r.predikat || '-'}</td>
                    <td><button className="tf-btn-sm" onClick={() => hapus(r.id)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
