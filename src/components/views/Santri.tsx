'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api-client';
import { LEVEL_UMMI_OPTIONS } from '@/lib/helpers';
import { useSortable } from '@/lib/use-sortable';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';
import { useHalaqah } from '../HalaqahSelect';
import type { User } from '../AppShell';

export default function SantriView({ user }: { user: User }) {
  const [list, setList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ nama: '', nis: '', kelas_id: '', jenis_kelamin: 'Laki-laki', level_ummi: LEVEL_UMMI_OPTIONS[0], user_id: '' });

  // ---- Akun login siswa (admin) ----
  const [users, setUsers] = useState<any[]>([]);
  const [akunModal, setAkunModal] = useState(false);
  const [akunPassword, setAkunPassword] = useState('123456');
  const [akunBusy, setAkunBusy] = useState(false);
  const [akunHasil, setAkunHasil] = useState<any[] | null>(null);
  const isAdmin = user.role === 'admin';
  const [editing, setEditing] = useState<any | null>(null);

  const { list: halaqahList } = useHalaqah();
  const [uploadMode, setUploadMode] = useState<'tambah' | 'perbarui'>('tambah');
  const [buatBaru, setBuatBaru] = useState(false);
  const canEdit = user.role === 'admin' || user.role === 'penyimak';
  // guru per halaqah dijadikan kolom terpisah (guru_h_<id>) agar bisa diurutkan
  const rowsForTable = list.map((s) => {
    const guruCols: Record<string, string> = {};
    halaqahList.forEach((h) => { guruCols[`guru_h_${h.id}`] = (s.guru_halaqah && s.guru_halaqah[h.id]) || ''; });
    return { ...s, ...guruCols, kelas_nama: namaKelas(s.kelas_id) };
  });
  const { sorted, Th } = useSortable(rowsForTable);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/santri?with_posisi=1'),
      api.get('/kelas'),
      isAdmin ? api.get('/users') : Promise.resolve({ data: [] }),
    ])
      .then(([s, k, u]) => { setList(s.data); setKelasList(k.data); setUsers(u.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Akun ber-role Siswa yang belum dipakai siswa lain (kecuali siswa yang sedang diedit)
  function akunOptions(currentSantriId?: number) {
    const dipakai = new Set(list.filter((s) => s.user_id && s.id !== currentSantriId).map((s) => String(s.user_id)));
    return users.filter((u) => u.role === 'santri' && !dipakai.has(String(u.id)));
  }
  function usernameOf(userId: number | null) {
    const u = users.find((x) => x.id === userId);
    return u ? u.username : '';
  }
  const jumlahTanpaAkun = list.filter((s) => !s.user_id).length;

  async function buatAkunSemua() {
    setAkunBusy(true); setError('');
    try {
      const res = await api.post('/santri/buat-akun', { password: akunPassword });
      setAkunHasil(res.created || []);
      showToast(`${(res.created || []).length} akun siswa berhasil dibuat`);
      load();
    } catch (e: any) { setError(e.message); setAkunModal(false); }
    finally { setAkunBusy(false); }
  }
  function unduhAkun() {
    if (!akunHasil) return;
    const ws = XLSX.utils.json_to_sheet(akunHasil.map((a) => ({ Nama: a.nama, Kelas: a.kelas_nama, Username: a.username, Password: a.password })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Akun Siswa');
    XLSX.writeFile(wb, 'Akun-Login-Siswa.xlsx');
  }

  async function addSantri() {
    setError('');
    if (!form.nama.trim()) { setError('Nama siswa wajib diisi'); return; }
    try {
      await api.post('/santri', form);
      setForm({ nama: '', nis: '', kelas_id: '', jenis_kelamin: 'Laki-laki', level_ummi: LEVEL_UMMI_OPTIONS[0], user_id: '' });
      showToast('Siswa berhasil ditambahkan');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number, nama: string) {
    const s = list.find((x) => x.id === id);
    const n = s?.jumlah_setoran ?? 0;
    if (!confirm(
      `HAPUS PERMANEN siswa "${nama}"?\n\n` +
      `Siswa ini memiliki ${n} setoran. Menghapus siswa juga MENGHAPUS SEMUA data setoran, presensi, hafalan awal, dan guru pengampunya. Ini TIDAK bisa dibatalkan.\n\n` +
      `Jika hanya ingin mengubah NIS/nama/kelas, gunakan tombol Edit (✏️) — data setoran tidak terpengaruh.`
    )) return;
    try { await api.del(`/santri/${id}`); showToast('Siswa berhasil dihapus'); load(); } catch (e: any) { setError(e.message); }
  }

  async function simpanEdit() {
    if (!editing) return;
    try {
      await api.put(`/santri/${editing.id}`, {
        nama: editing.nama, nis: editing.nis, kelas_id: editing.kelas_id,
        jenis_kelamin: editing.jenis_kelamin, level_ummi: editing.level_ummi,
        ...(isAdmin ? { user_id: editing.user_id || null } : {}),
      });
      showToast('Perubahan berhasil disimpan');
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
  }

  function namaKelas(id: number) {
    return kelasList.find((k) => k.id === id)?.nama_kelas || '(belum ada kelas)';
  }

  function downloadTemplateSiswa() {
    const contohKelas = kelasList[0] ? kelasList[0].nama_kelas : 'Nama Kelas';
    const rows = [
      { Nama: 'Contoh Siswa', NIS: '12345', Kelas: contohKelas, 'Jenis Kelamin': 'Laki-laki', 'Level Ummi': 'Jilid 1' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const ket = [
      ['Petunjuk Pengisian'],
      ['1. Kolom Kelas harus sama persis dengan nama kelas yang sudah ada di menu Data Kelas.'],
      ['2. Kolom Level Ummi harus salah satu dari: ' + LEVEL_UMMI_OPTIONS.join(', ')],
      ['3. Jangan mengubah nama kolom (header) pada baris pertama sheet Template.'],
      ['4. Mode "Tambah siswa baru" selalu membuat siswa baru. Untuk memperbarui NIS/kelas/level siswa yang SUDAH ADA, pilih mode "Perbarui data yang ada" (hanya kolom yang diisi yang diubah; setoran tidak terpengaruh).'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ket), 'Petunjuk');
    XLSX.writeFile(wb, 'Template-Data-Siswa.xlsx');
  }

  function uploadSiswa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const kelasMap: Record<string, number> = {};
        kelasList.forEach((k) => { kelasMap[String(k.nama_kelas).trim().toLowerCase()] = k.id; });

        // ===== MODE PERBARUI (admin): cocokkan dengan siswa yang sudah ada, setoran tidak tersentuh =====
        if (isAdmin && uploadMode === 'perbarui') {
          const mapped: any[] = []; const skippedU: string[] = [];
          rows.forEach((r, idx) => {
            const nama = String(r['Nama'] || r['nama'] || '').trim();
            if (!nama) return;
            const kelasNama = String(r['Kelas'] || r['kelas'] || '').trim();
            const kelasId = kelasNama ? kelasMap[kelasNama.toLowerCase()] : undefined;
            if (kelasNama && !kelasId) { skippedU.push(`Baris ${idx + 2}: Kelas "${kelasNama}" tidak ditemukan di Data Kelas`); return; }
            mapped.push({
              nama, nis: String(r['NIS'] || r['nis'] || '').trim(), kelas_id: kelasId,
              jenis_kelamin: String(r['Jenis Kelamin'] || r['jenis_kelamin'] || '').trim(),
              level_ummi: String(r['Level Ummi'] || r['level_ummi'] || '').trim(),
            });
          });
          setUploading(true);
          try {
            const res = await api.post('/santri/impor', { rows: mapped, buat_baru: buatBaru });
            showToast(`${res.diperbarui} siswa diperbarui, ${res.tidak_berubah} tidak berubah${res.dibuat ? `, ${res.dibuat} dibuat baru` : ''}`);
            const lines = [...skippedU];
            if (res.tidak_ditemukan.length) lines.push(`${res.tidak_ditemukan.length} nama tidak ditemukan (tidak dibuat): ` + res.tidak_ditemukan.join(', '));
            res.ganda.forEach((g: string) => lines.push(g));
            if (lines.length) setError('Catatan hasil upload:\n' + lines.join('\n'));
            load();
          } catch (err: any) { setError(err.message); }
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const toAdd: any[] = [];
        const skipped: string[] = [];
        rows.forEach((r, idx) => {
          const nama = r['Nama'] || r['nama'];
          const kelasNama = String(r['Kelas'] || r['kelas'] || '').trim();
          const kelasId = kelasMap[kelasNama.toLowerCase()];
          if (!nama) { skipped.push(`Baris ${idx + 2}: Nama kosong`); return; }
          if (!kelasId) { skipped.push(`Baris ${idx + 2}: Kelas "${kelasNama}" tidak ditemukan di Data Kelas`); return; }
          toAdd.push({
            nama, nis: r['NIS'] || r['nis'] || '', kelas_id: kelasId,
            jenis_kelamin: r['Jenis Kelamin'] || r['jenis_kelamin'] || '',
            level_ummi: r['Level Ummi'] || r['level_ummi'] || '',
          });
        });

        setUploading(true);
        let successCount = 0;
        for (const item of toAdd) {
          try { await api.post('/santri', item); successCount++; }
          catch (err: any) { skipped.push(`${item.nama}: ${err.message}`); }
        }
        setUploading(false);
        showToast(`${successCount} siswa berhasil ditambahkan dari file`);
        if (skipped.length) setError(`${skipped.length} baris dilewati:\n` + skipped.join('\n'));
        load();
      } catch (err: any) {
        setUploading(false);
        setError('Gagal membaca file: ' + err.message);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div>
      <h1 className="tf-title">Data Siswa</h1>
      {error && <div className="tf-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      {canEdit && (
        <div className="tf-panel">
          <div className="tf-panel-head">Tambah Siswa</div>
          <div className="tf-panel-body">
            <div className="tf-field">
              <label>Nama</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="tf-field">
              <label>NIS</label>
              <input value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
            </div>
            <div className="tf-field">
              <label>Kelas</label>
              <select value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                <option value="">- Pilih Kelas -</option>
                {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>
            <div className="tf-field">
              <label>Jenis Kelamin</label>
              <select value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            <div className="tf-field">
              <label>Level/Jilid Ummi</label>
              <select value={form.level_ummi} onChange={(e) => setForm({ ...form, level_ummi: e.target.value })}>
                {LEVEL_UMMI_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="tf-field">
                <label>Akun Login Siswa (opsional)</label>
                <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                  <option value="">- Belum ada akun -</option>
                  {akunOptions().map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.username})</option>)}
                </select>
              </div>
            )}
            <button className="tf-btn" onClick={addSantri}>Tambah</button>
          </div>
        </div>
      )}

      <div className="tf-panel">
        <div className="tf-panel-head" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span>Daftar Siswa</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="tf-btn-sm" onClick={downloadTemplateSiswa}>⬇ Download Template</button>
            {isAdmin && (
              <button className="tf-btn-sm" onClick={() => { setAkunHasil(null); setAkunModal(true); }}>🔑 Buat Akun Semua Siswa</button>
            )}
            {isAdmin && (
              <>
                <select value={uploadMode} onChange={(e) => setUploadMode(e.target.value as any)} title="Mode upload">
                  <option value="tambah">Upload: Tambah siswa baru</option>
                  <option value="perbarui">Upload: Perbarui data yang ada</option>
                </select>
                {uploadMode === 'perbarui' && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
                    <input type="checkbox" checked={buatBaru} onChange={(e) => setBuatBaru(e.target.checked)} />
                    buat baru jika tidak ditemukan
                  </label>
                )}
              </>
            )}
            {canEdit && (
              <label className="tf-btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                {uploading ? 'Mengunggah...' : '⬆ Upload Data'}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={uploadSiswa} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : list.length === 0 ? (
            <div className="tf-empty">Belum ada data siswa.</div>
          ) : (
            <table className="tf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <Th sortk="nama" label="Nama" />
                  <Th sortk="nis" label="NIS" />
                  <Th sortk="kelas_nama" label="Kelas" />
                  <Th sortk="level_ummi" label="Level Ummi" />
                  <th>Halaman Terakhir</th>
                  <th>Surah Terakhir</th>
                  <Th sortk="jenis_kelamin" label="Jenis Kelamin" />
                  {halaqahList.map((h) => <Th key={h.id} sortk={`guru_h_${h.id}`} label={`Guru ${h.nama}`} />)}
                  {isAdmin && <th>Akun Login</th>}
                  {canEdit && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                    <td>{s.nama}</td>
                    <td>{s.nis || '-'}</td>
                    <td>{s.kelas_nama}</td>
                    <td>{s.level_ummi || '-'}</td>
                    <td>{s.halaman_terakhir}</td>
                    <td>{s.surah_terakhir}</td>
                    <td>{s.jenis_kelamin || '-'}</td>
                    {halaqahList.map((h) => <td key={h.id}>{s[`guru_h_${h.id}`] || '-'}</td>)}
                    {isAdmin && <td>{s.user_id ? usernameOf(s.user_id) || '✓' : <span style={{ color: '#9ca3af' }}>-</span>}</td>}
                    {canEdit && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="tf-btn-icon" title="Edit" onClick={() => setEditing({ ...s })}>✏️</button>
                        {user.role === 'admin' && (
                          <button className="tf-btn-icon tf-btn-icon-del" title="Hapus" onClick={() => hapus(s.id, s.nama)}>🗑</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3>Edit Siswa</h3>
          <div className="tf-field">
            <label>Nama</label>
            <input value={editing.nama} onChange={(e) => setEditing({ ...editing, nama: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>NIS</label>
            <input value={editing.nis || ''} onChange={(e) => setEditing({ ...editing, nis: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Kelas</label>
            <select value={editing.kelas_id || ''} onChange={(e) => setEditing({ ...editing, kelas_id: e.target.value })}>
              <option value="">- Pilih Kelas -</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>
          <div className="tf-field">
            <label>Jenis Kelamin</label>
            <select value={editing.jenis_kelamin || ''} onChange={(e) => setEditing({ ...editing, jenis_kelamin: e.target.value })}>
              <option>Laki-laki</option>
              <option>Perempuan</option>
            </select>
          </div>
          <div className="tf-field">
            <label>Level/Jilid Ummi</label>
            <select value={editing.level_ummi || ''} onChange={(e) => setEditing({ ...editing, level_ummi: e.target.value })}>
              {LEVEL_UMMI_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="tf-field">
              <label>Akun Login Siswa</label>
              <select value={editing.user_id || ''} onChange={(e) => setEditing({ ...editing, user_id: e.target.value })}>
                <option value="">- Belum ada akun -</option>
                {akunOptions(editing.id).map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.username})</option>)}
              </select>
            </div>
          )}
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setEditing(null)}>Batal</button>
            <button className="tf-btn" onClick={simpanEdit}>Simpan</button>
          </div>
        </Modal>
      )}

      {akunModal && (
        <Modal onClose={() => setAkunModal(false)}>
          {!akunHasil ? (
            <>
              <h3>Buat Akun Login Semua Siswa</h3>
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Akun role <b>Siswa</b> akan dibuat untuk <b>{jumlahTanpaAkun}</b> siswa yang belum punya akun, lalu otomatis dihubungkan ke data siswanya.
                Username = <b>NIS</b> (jika kosong: nama tanpa spasi). Siswa yang sudah punya akun tidak diubah.
              </p>
              <div className="tf-field">
                <label>Password awal (sama untuk semua, minimal 6 karakter)</label>
                <input value={akunPassword} onChange={(e) => setAkunPassword(e.target.value)} />
              </div>
              <div className="tf-modal-actions">
                <button className="tf-btn tf-btn-secondary" onClick={() => setAkunModal(false)}>Batal</button>
                <button className="tf-btn" disabled={akunBusy || jumlahTanpaAkun === 0} onClick={buatAkunSemua}>
                  {akunBusy ? 'Membuat akun...' : `Buat ${jumlahTanpaAkun} Akun`}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>{akunHasil.length} Akun Berhasil Dibuat</h3>
              <p className="tf-empty" style={{ textAlign: 'left' }}>
                Simpan daftar ini sekarang (password hanya ditampilkan sekali). Siswa disarankan mengganti password setelah login pertama.
              </p>
              <div className="tf-table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="tf-table">
                  <thead><tr><th>Nama</th><th>Kelas</th><th>Username</th><th>Password</th></tr></thead>
                  <tbody>
                    {akunHasil.map((a) => (
                      <tr key={a.santri_id}><td>{a.nama}</td><td>{a.kelas_nama}</td><td>{a.username}</td><td>{a.password}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tf-modal-actions">
                <button className="tf-btn tf-btn-secondary" onClick={() => setAkunModal(false)}>Tutup</button>
                <button className="tf-btn" onClick={unduhAkun}>⬇ Unduh Excel</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
