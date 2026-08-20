'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { UMMI_RUBRIK, LEVEL_JILID_UMMI, MAX_HALAMAN_UMMI, calcPredikat } from '@/lib/helpers';
import { SURAH_PAGES } from '@/lib/surah-pages';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';
import type { User } from '../AppShell';

const JENIS_OPTIONS = ['Hafalan Baru', 'Murojaah', 'Tilawah'] as const;
type Jenis = typeof JENIS_OPTIONS[number];

type JenisFields = { surahMulai: string; ayatMulai: string; surahSelesai: string; ayatSelesai: string; nilai: string };
const emptyJenisFields = (): JenisFields => ({ surahMulai: '', ayatMulai: '', surahSelesai: '', ayatSelesai: '', nilai: '' });

function isJilidUmmiLevel(level: string) {
  return LEVEL_JILID_UMMI.includes(level);
}

function ayatCountForSurah(nama: string): number {
  const s = SURAH_PAGES.find((x) => x[1] === nama);
  return s ? s[3] : 0;
}

function nowDateTimeStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const HALAMAN_OPTIONS = Array.from({ length: MAX_HALAMAN_UMMI }, (_, i) => i + 1);

export default function SetoranView({ user }: { user: User }) {
  const [santriList, setSantriList] = useState<any[]>([]);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);

  const [tanggal, setTanggal] = useState(nowDateTimeStr());
  const [santriId, setSantriId] = useState('');
  const [catatan, setCatatan] = useState('');

  const [ummiChecked, setUmmiChecked] = useState(true);
  const [halamanMulai, setHalamanMulai] = useState('');
  const [halamanSelesai, setHalamanSelesai] = useState('');
  const [rubrikKode, setRubrikKode] = useState('');

  const [jenisChecked, setJenisChecked] = useState<Record<Jenis, boolean>>({
    'Hafalan Baru': false, 'Murojaah': false, 'Tilawah': false,
  });
  const [jenisFields, setJenisFields] = useState<Record<Jenis, JenisFields>>({
    'Hafalan Baru': emptyJenisFields(), 'Murojaah': emptyJenisFields(), 'Tilawah': emptyJenisFields(),
  });

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/santri?binaan_only=1&with_posisi=1'),
      api.get('/setoran'),
    ])
      .then(([s, r]) => { setSantriList(s.data); setRiwayat(r.data.slice(0, 20)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const siswaTerpilih = santriList.find((s) => String(s.id) === String(santriId));
  const level = siswaTerpilih?.level_ummi || '';
  const isJilid = isJilidUmmiLevel(level);

  // Setiap ganti siswa: reset form dinamis & tentukan default centang sesuai level,
  // persis seperti renderSetoranFields() di versi lama.
  function pilihSiswa(id: string) {
    setSantriId(id);
    setUmmiChecked(true);
    setHalamanMulai(''); setHalamanSelesai(''); setRubrikKode('');
    const s = santriList.find((x) => String(x.id) === String(id));
    const lvlJilid = isJilidUmmiLevel(s?.level_ummi || '');
    setJenisChecked({
      'Hafalan Baru': !lvlJilid, // kalau bukan level Jilid, "Hafalan Baru" tercentang default
      'Murojaah': false,
      'Tilawah': false,
    });
    setJenisFields({ 'Hafalan Baru': emptyJenisFields(), 'Murojaah': emptyJenisFields(), 'Tilawah': emptyJenisFields() });
  }

  function updateJenisField(jenis: Jenis, field: keyof JenisFields, value: string) {
    setJenisFields((prev) => {
      const next = { ...prev, [jenis]: { ...prev[jenis], [field]: value } };
      // Surah Akhir otomatis mengikuti Surah Awal (kasus umum 1 surah).
      if (field === 'surahMulai') {
        next[jenis] = { ...next[jenis], surahSelesai: value, ayatMulai: '', ayatSelesai: '' };
      }
      if (field === 'surahSelesai') {
        next[jenis] = { ...next[jenis], ayatSelesai: '' };
      }
      return next;
    });
  }

  function resetForm() {
    setUmmiChecked(true);
    setHalamanMulai(''); setHalamanSelesai(''); setRubrikKode('');
    setJenisChecked({ 'Hafalan Baru': false, 'Murojaah': false, 'Tilawah': false });
    setJenisFields({ 'Hafalan Baru': emptyJenisFields(), 'Murojaah': emptyJenisFields(), 'Tilawah': emptyJenisFields() });
    setCatatan('');
  }

  async function submit() {
    setError(''); setOk('');
    if (!santriId) { setError('Pilih siswa terlebih dahulu'); return; }

    const items: any[] = [];

    if (isJilid && ummiChecked) {
      const grade = UMMI_RUBRIK.find((g) => g.kode === rubrikKode);
      if (!halamanMulai || !halamanSelesai || !grade) {
        setError('Untuk Penilaian Metode Ummi: halaman awal, halaman akhir, dan nilai konversi wajib diisi (atau hilangkan centangnya jika tidak ingin mengisi hari ini).');
        return;
      }
      items.push({
        jenis: 'Setoran Metode Ummi',
        halaman_mulai: halamanMulai,
        halaman_selesai: halamanSelesai,
        nilai: grade.nilai,
        predikat: grade.label.split(' ')[0],
        catatan: grade.keterangan + (catatan ? ' — ' + catatan : ''),
      });
    }

    for (const j of JENIS_OPTIONS) {
      if (!jenisChecked[j]) continue;
      const f = jenisFields[j];
      const surahSelesai = f.surahSelesai || f.surahMulai;
      if (!f.surahMulai || !f.ayatMulai || !surahSelesai || !f.ayatSelesai || !f.nilai) {
        setError(`Untuk jenis "${j}", surah awal, ayat awal, surah akhir, ayat akhir, dan nilai wajib diisi.`);
        return;
      }
      items.push({
        jenis: j,
        surah: f.surahMulai,
        surah_selesai: surahSelesai,
        ayat_mulai: f.ayatMulai,
        ayat_selesai: f.ayatSelesai,
        nilai: Number(f.nilai),
        catatan,
      });
    }

    if (items.length === 0) {
      setError('Isi minimal salah satu: Penilaian Metode Ummi, atau pilih jenis setoran (Hafalan Baru / Murojaah / Tilawah).');
      return;
    }

    try {
      await api.post('/setoran', { tanggal: tanggal.slice(0, 10), santri_id: Number(santriId), items, catatan });
      showToast('Setoran berhasil disimpan');
      resetForm();
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number) {
    if (!confirm('Hapus setoran ini?')) return;
    try { await api.del(`/setoran/${id}`); showToast('Setoran berhasil dihapus'); load(); } catch (e: any) { setError(e.message); }
  }

  const [editing, setEditing] = useState<any | null>(null);

  async function simpanEdit() {
    if (!editing) return;
    try {
      const nilai = editing.nilai === '' || editing.nilai === null ? null : Number(editing.nilai);
      await api.put(`/setoran/${editing.id}`, {
        nilai, predikat: nilai !== null ? calcPredikat(nilai) : editing.predikat, catatan: editing.catatan,
      });
      showToast('Perubahan berhasil disimpan');
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
  }


  return (
    <div>
      <h1 className="tf-title">Setoran Hafalan</h1>
      {error && <div className="tf-error">{error}</div>}
      {ok && <div className="tf-empty">{ok}</div>}

      <div className="tf-panel">
        <div className="tf-panel-head">Tambah Setoran</div>
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Nama Siswa</label>
            <select value={santriId} onChange={(e) => pilihSiswa(e.target.value)}>
              <option value="">-- pilih siswa --</option>
              {santriList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>

          {siswaTerpilih && (
            <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
              {siswaTerpilih.halaman_terakhir && siswaTerpilih.halaman_terakhir !== '-' && (
                <>📄 Halaman terakhir: <b>{siswaTerpilih.halaman_terakhir}</b><br /></>
              )}
              {siswaTerpilih.surah_terakhir && siswaTerpilih.surah_terakhir !== '-' && (
                <>📖 Surah terakhir: <b>{siswaTerpilih.surah_terakhir}</b></>
              )}
              {(!siswaTerpilih.halaman_terakhir || siswaTerpilih.halaman_terakhir === '-') &&
               (!siswaTerpilih.surah_terakhir || siswaTerpilih.surah_terakhir === '-') &&
                'Belum ada riwayat setoran/hafalan baru untuk siswa ini.'}
            </div>
          )}

          <div className="tf-field">
            <label>Tanggal &amp; Waktu Setoran</label>
            <input type="datetime-local" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>

          {santriId && (
            <>
              {isJilid && (
                <div className="tf-panel" style={{ margin: '10px 0', background: 'var(--surface-alt)' }}>
                  <div className="tf-panel-body">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
                      <input type="checkbox" checked={ummiChecked} onChange={(e) => setUmmiChecked(e.target.checked)} />
                      Penilaian Metode Ummi (Setoran Baru — per halaman)
                    </label>
                    {ummiChecked && (
                      <>
                        <div className="tf-field">
                          <label>Halaman Awal</label>
                          <select value={halamanMulai} onChange={(e) => setHalamanMulai(e.target.value)}>
                            <option value="">-</option>
                            {HALAMAN_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div className="tf-field">
                          <label>Halaman Akhir</label>
                          <select value={halamanSelesai} onChange={(e) => setHalamanSelesai(e.target.value)}>
                            <option value="">-</option>
                            {HALAMAN_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div className="tf-field">
                          <label>Nilai (Konversi Metode Ummi)</label>
                          <select value={rubrikKode} onChange={(e) => setRubrikKode(e.target.value)}>
                            <option value="">-- pilih nilai --</option>
                            {UMMI_RUBRIK.map((r) => <option key={r.kode} value={r.kode}>{r.label}</option>)}
                          </select>
                          {rubrikKode && (() => {
                            const g = UMMI_RUBRIK.find((r) => r.kode === rubrikKode)!;
                            return (
                              <div className="tf-empty" style={{ marginTop: 8 }}>
                                Nilai: <b>{g.nilai}</b> &nbsp;|&nbsp; Kesalahan: <b>{g.kesalahan}</b> &nbsp;|&nbsp; {g.status}
                                <br />{g.keterangan}
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="tf-empty" style={{ margin: '10px 0' }}>
                {isJilid
                  ? <>Siswa level <b>{level || '-'}</b> (Jilid Ummi) — selain Penilaian Metode Ummi di atas, pilih juga jenis setoran lain yang ingin diinput hari ini (boleh lebih dari satu).</>
                  : <>Siswa level <b>{level || '-'}</b> — pilih jenis setoran yang ingin diinput hari ini (boleh lebih dari satu).</>}
              </div>

              <div className="tf-field">
                <label>3 Jenis Setoran</label>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {JENIS_OPTIONS.map((j) => (
                    <label key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={jenisChecked[j]}
                        onChange={(e) => setJenisChecked((prev) => ({ ...prev, [j]: e.target.checked }))}
                      />
                      {j}
                    </label>
                  ))}
                </div>
              </div>

              {!JENIS_OPTIONS.some((j) => jenisChecked[j]) && (
                <div className="tf-empty">Pilih minimal satu jenis setoran di atas (jika tidak diisi, pastikan Penilaian Metode Ummi di atas dicentang).</div>
              )}

              {JENIS_OPTIONS.filter((j) => jenisChecked[j]).map((j) => {
                const f = jenisFields[j];
                const ayatMulaiCount = ayatCountForSurah(f.surahMulai);
                const ayatSelesaiCount = ayatCountForSurah(f.surahSelesai || f.surahMulai);
                return (
                  <div key={j} className="tf-panel" style={{ margin: '10px 0', background: 'var(--surface-alt)' }}>
                    <div className="tf-panel-body">
                      <p style={{ fontWeight: 600, margin: '0 0 8px' }}>{j}</p>
                      <div className="tf-field">
                        <label>Surah Awal</label>
                        <select value={f.surahMulai} onChange={(e) => updateJenisField(j, 'surahMulai', e.target.value)}>
                          <option value="">-- pilih surah --</option>
                          {SURAH_PAGES.map((s) => <option key={s[0]} value={s[1]}>{s[0]}. {s[1]}</option>)}
                        </select>
                      </div>
                      <div className="tf-field">
                        <label>Ayat Awal</label>
                        <select value={f.ayatMulai} onChange={(e) => updateJenisField(j, 'ayatMulai', e.target.value)}>
                          <option value="">-</option>
                          {Array.from({ length: ayatMulaiCount }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div className="tf-field">
                        <label>Surah Akhir</label>
                        <select value={f.surahSelesai} onChange={(e) => updateJenisField(j, 'surahSelesai', e.target.value)}>
                          <option value="">-- pilih surah --</option>
                          {SURAH_PAGES.map((s) => <option key={s[0]} value={s[1]}>{s[0]}. {s[1]}</option>)}
                        </select>
                      </div>
                      <div className="tf-field">
                        <label>Ayat Akhir</label>
                        <select value={f.ayatSelesai} onChange={(e) => updateJenisField(j, 'ayatSelesai', e.target.value)}>
                          <option value="">-</option>
                          {Array.from({ length: ayatSelesaiCount }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div className="tf-empty" style={{ margin: '-2px 0 8px', fontSize: 11.5 }}>
                        Surah Akhir otomatis mengikuti Surah Awal — ubah jika siswa setor lebih dari satu surah dalam pertemuan ini.
                      </div>
                      <div className="tf-field">
                        <label>Nilai (0-100)</label>
                        <input type="number" min={0} max={100} value={f.nilai} onChange={(e) => updateJenisField(j, 'nilai', e.target.value)} />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="tf-field">
                <label>Catatan</label>
                <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} />
              </div>

              <button className="tf-btn" onClick={submit}>Simpan</button>
            </>
          )}
        </div>
      </div>

      <div className="tf-panel">
        <div className="tf-panel-head">Daftar Setoran</div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : riwayat.length === 0 ? (
            <div className="tf-empty">Belum ada setoran tercatat.</div>
          ) : (
            <table className="tf-table">
              <thead><tr><th>#</th><th>Tanggal</th><th>Jenis</th><th>Surah/Halaman</th><th>Nilai</th><th>Predikat</th><th>Aksi</th></tr></thead>
              <tbody>
                {riwayat.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                    <td>{String(r.tanggal).substring(0, 10)}</td>
                    <td><span className={`tf-badge ${r.jenis === 'Murojaah' ? 'b-murajaah' : r.jenis === 'Tilawah' ? 'b-tilawah' : r.jenis === 'Setoran Metode Ummi' ? 'b-ummi' : 'b-hafalan'}`}>{r.jenis}</span></td>
                    <td>{r.jenis === 'Setoran Metode Ummi' ? `Hal. ${r.halaman_mulai}-${r.halaman_selesai}` : `${r.surah} : ${r.ayat_mulai}-${r.ayat_selesai}`}</td>
                    <td>{r.nilai ?? '-'}</td>
                    <td>{r.predikat || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="tf-btn-icon" title="Edit" onClick={() => setEditing({ ...r })}>✏️</button>
                      <button className="tf-btn-icon tf-btn-icon-del" title="Hapus" onClick={() => hapus(r.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3>Edit Setoran</h3>
          <p className="tf-empty">{editing.jenis} — {String(editing.tanggal).substring(0, 10)}</p>
          <div className="tf-field">
            <label>Nilai (0-100)</label>
            <input type="number" min={0} max={100} value={editing.nilai ?? ''} onChange={(e) => setEditing({ ...editing, nilai: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Catatan</label>
            <textarea rows={2} value={editing.catatan || ''} onChange={(e) => setEditing({ ...editing, catatan: e.target.value })} />
          </div>
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setEditing(null)}>Batal</button>
            <button className="tf-btn" onClick={simpanEdit}>Simpan</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
