'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/menu';
import { useSortable } from '@/lib/use-sortable';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';

const ROLE_OPTIONS = ['admin', 'penyimak', 'santri', 'tamu'] as const;

export default function UsersView() {
  const [list, setList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [santriList, setSantriList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', username: '', password: '', role: 'penyimak', kelas_id: '' });
  const [editing, setEditing] = useState<any | null>(null);
  const [changingPwFor, setChangingPwFor] = useState<any | null>(null);
  const [newPw, setNewPw] = useState('');

  const [binaanFor, setBinaanFor] = useState<number | null>(null);
  const [binaanChecked, setBinaanChecked] = useState<Set<number>>(new Set());
  const [binaanSearch, setBinaanSearch] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/kelas'), api.get('/santri')])
      .then(([u, k, s]) => { setList(u.data); setKelasList(k.data); setSantriList(s.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function namaKelas(id: number) {
    return kelasList.find((k) => k.id === id)?.nama_kelas || '-';
  }

  const rowsForTable = list.map((u) => ({ ...u, kelas_nama: namaKelas(u.kelas_id) }));
  const { sorted, Th } = useSortable(rowsForTable);

  async function addUser() {
    setError('');
    if (!form.nama.trim() || !form.username.trim()) { setError('Nama dan username wajib diisi'); return; }
    try {
      await api.post('/users', form);
      setForm({ nama: '', username: '', password: '', role: 'penyimak', kelas_id: '' });
      showToast('Pengguna berhasil ditambahkan');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number, nama: string) {
    if (!confirm(`Hapus pengguna "${nama}"?`)) return;
    try { await api.del(`/users/${id}`); showToast('Pengguna berhasil dihapus'); load(); } catch (e: any) { setError(e.message); }
  }

  async function toggleStatus(u: any) {
    try {
      await api.put(`/users/${u.id}`, { status: u.status === 'aktif' ? 'nonaktif' : 'aktif' });
      showToast(u.status === 'aktif' ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function simpanEdit() {
    if (!editing) return;
    try {
      await api.put(`/users/${editing.id}`, { nama: editing.nama, role: editing.role, kelas_id: editing.kelas_id || null });
      showToast('Perubahan berhasil disimpan');
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function simpanPassword() {
    if (!changingPwFor) return;
    if (newPw.length < 6) { setError('Password baru minimal 6 karakter'); return; }
    try {
      await api.put(`/users/${changingPwFor.id}`, { password: newPw });
      showToast(`Password ${changingPwFor.nama} berhasil diubah`);
      setChangingPwFor(null); setNewPw('');
    } catch (e: any) { setError(e.message); }
  }

  async function bukaBinaan(u: any) {
    setError('');
    try {
      const res = await api.get(`/penyimak-santri?penyimak_id=${u.id}`);
      setBinaanChecked(new Set((res.data || []).map((r: any) => Number(r.santri_id))));
      setBinaanFor(u.id);
      setBinaanSearch('');
    } catch (e: any) { setError(e.message); }
  }

  function toggleBinaan(santriId: number) {
    setBinaanChecked((prev) => {
      const next = new Set(prev);
      if (next.has(santriId)) next.delete(santriId); else next.add(santriId);
      return next;
    });
  }

  async function simpanBinaan() {
    if (binaanFor === null) return;
    try {
      await api.post('/penyimak-santri', { penyimak_id: binaanFor, santri_ids: Array.from(binaanChecked) });
      showToast('Data siswa binaan berhasil disimpan');
      setBinaanFor(null);
    } catch (e: any) { setError(e.message); }
  }

  const binaanFilteredSantri = santriList.filter((s) => s.nama.toLowerCase().includes(binaanSearch.toLowerCase()));

  return (
    <div>
      <h1 className="tf-title">Pengguna</h1>
      {error && <div className="tf-error">{error}</div>}

      <div className="tf-panel">
        <div className="tf-panel-head">Tambah Pengguna</div>
        <div className="tf-panel-body">
          <div className="tf-field">
            <label>Nama</label>
            <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Password (kosongkan = default 123456)</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {(form.role === 'penyimak' || form.role === 'santri') && (
            <div className="tf-field">
              <label>Kelas (opsional)</label>
              <select value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                <option value="">- Tidak diset -</option>
                {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>
          )}
          <button className="tf-btn" onClick={addUser}>Tambah</button>
        </div>
      </div>

      <div className="tf-panel">
        <div className="tf-panel-head">Daftar Pengguna</div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : list.length === 0 ? (
            <div className="tf-empty">Belum ada pengguna.</div>
          ) : (
            <table className="tf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <Th sortk="username" label="Username" />
                  <Th sortk="nama" label="Nama" />
                  <Th sortk="role" label="Role" />
                  <Th sortk="kelas_nama" label="Kelas" />
                  <Th sortk="status" label="Status" />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                    <td>{u.username}</td>
                    <td>{u.nama}</td>
                    <td><span className={`tf-role-badge tf-role-${u.role}`}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</span></td>
                    <td>{u.kelas_nama}</td>
                    <td>{u.status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="tf-btn-icon" title="Edit" onClick={() => setEditing({ ...u })}>✏️</button>
                      <button className="tf-btn-icon" title="Ganti Password" onClick={() => { setChangingPwFor(u); setNewPw(''); }}>🔑</button>
                      <button className="tf-btn-icon tf-btn-icon-del" title="Hapus" onClick={() => hapus(u.id, u.nama)}>🗑</button>
                      <button className="tf-btn-sm" onClick={() => toggleStatus(u)} style={{ marginLeft: 4 }}>
                        {u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      {u.role === 'penyimak' && (
                        <button className="tf-btn-sm" onClick={() => bukaBinaan(u)} style={{ marginLeft: 4 }}>👥 Siswa Binaan</button>
                      )}
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
          <h3>Edit Pengguna</h3>
          <div className="tf-field">
            <label>Nama</label>
            <input value={editing.nama} onChange={(e) => setEditing({ ...editing, nama: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Username</label>
            <input value={editing.username} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="tf-field">
            <label>Role</label>
            <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="tf-field">
            <label>Kelas</label>
            <select value={editing.kelas_id || ''} onChange={(e) => setEditing({ ...editing, kelas_id: e.target.value })}>
              <option value="">- Tidak diset -</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setEditing(null)}>Batal</button>
            <button className="tf-btn" onClick={simpanEdit}>Simpan</button>
          </div>
        </Modal>
      )}

      {changingPwFor && (
        <Modal onClose={() => setChangingPwFor(null)}>
          <h3>Ganti Password — {changingPwFor.nama}</h3>
          <div className="tf-field">
            <label>Password Baru (minimal 6 karakter)</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setChangingPwFor(null)}>Batal</button>
            <button className="tf-btn" onClick={simpanPassword}>Simpan</button>
          </div>
        </Modal>
      )}

      {binaanFor !== null && (
        <div className="tf-panel">
          <div className="tf-panel-head">
            Siswa Binaan — {list.find((u) => u.id === binaanFor)?.nama}
          </div>
          <div className="tf-panel-body">
            <p className="tf-empty" style={{ marginBottom: 8 }}>Pilih siswa yang diampu penyimak ini. Boleh lintas kelas & lintas level.</p>
            <input
              placeholder="Cari nama siswa..."
              value={binaanSearch}
              onChange={(e) => setBinaanSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 10, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
              {binaanFilteredSantri.length === 0 ? <div className="tf-empty">Tidak ada siswa yang cocok.</div> : (
                binaanFilteredSantri.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={binaanChecked.has(s.id)} onChange={() => toggleBinaan(s.id)} />
                    <span style={{ flex: 1 }}>{s.nama}</span>
                    <span className="tf-empty">{namaKelas(s.kelas_id)} · {s.level_ummi || '-'}</span>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="tf-btn" onClick={simpanBinaan}>Simpan</button>
              <button className="tf-btn-sm" onClick={() => setBinaanFor(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
