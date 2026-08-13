'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

const ROLE_OPTIONS = ['admin', 'penyimak', 'santri', 'tamu'];

export default function UsersView() {
  const [list, setList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', username: '', password: '', role: 'penyimak', kelas_id: '' });

  function load() {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/kelas')])
      .then(([u, k]) => { setList(u.data); setKelasList(k.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addUser() {
    setError('');
    if (!form.nama.trim() || !form.username.trim()) { setError('Nama dan username wajib diisi'); return; }
    try {
      await api.post('/users', form);
      setForm({ nama: '', username: '', password: '', role: 'penyimak', kelas_id: '' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number) {
    if (!confirm('Hapus pengguna ini?')) return;
    try { await api.del(`/users/${id}`); load(); } catch (e: any) { setError(e.message); }
  }

  async function toggleStatus(u: any) {
    try {
      await api.put(`/users/${u.id}`, { status: u.status === 'aktif' ? 'nonaktif' : 'aktif' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  function namaKelas(id: number) {
    return kelasList.find((k) => k.id === id)?.nama_kelas || '-';
  }

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
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {form.role === 'penyimak' && (
            <div className="tf-field">
              <label>Kelas (wali/binaan utama, opsional)</label>
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
              <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nama}</td>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{namaKelas(u.kelas_id)}</td>
                    <td>{u.status}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="tf-btn-sm" onClick={() => toggleStatus(u)}>
                        {u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button className="tf-btn-sm" onClick={() => hapus(u.id)}>Hapus</button>
                    </td>
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
