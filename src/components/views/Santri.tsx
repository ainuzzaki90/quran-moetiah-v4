'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

export default function SantriView({ user }: { user: User }) {
  const [list, setList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', nis: '', kelas_id: '', jenis_kelamin: 'L', level_ummi: '' });

  const canEdit = user.role === 'admin' || user.role === 'penyimak';

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/santri?with_posisi=1'),
      api.get('/kelas'),
    ])
      .then(([s, k]) => { setList(s.data); setKelasList(k.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addSantri() {
    setError('');
    if (!form.nama.trim()) { setError('Nama santri wajib diisi'); return; }
    try {
      await api.post('/santri', form);
      setForm({ nama: '', nis: '', kelas_id: '', jenis_kelamin: 'L', level_ummi: '' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number) {
    if (!confirm('Hapus data santri ini?')) return;
    try { await api.del(`/santri/${id}`); load(); } catch (e: any) { setError(e.message); }
  }

  function namaKelas(id: number) {
    return kelasList.find((k) => k.id === id)?.nama_kelas || '-';
  }

  return (
    <div>
      <h1 className="tf-title">Data Siswa</h1>
      {error && <div className="tf-error">{error}</div>}

      {canEdit && (
        <div className="tf-panel">
          <div className="tf-panel-head">Tambah Santri</div>
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
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div className="tf-field">
              <label>Level Ummi (jika masih Jilid)</label>
              <input value={form.level_ummi} onChange={(e) => setForm({ ...form, level_ummi: e.target.value })} placeholder="Contoh: Jilid 3 / Al-Qur'an" />
            </div>
            <button className="tf-btn" onClick={addSantri}>Tambah</button>
          </div>
        </div>
      )}

      <div className="tf-panel">
        <div className="tf-panel-head">Daftar Santri</div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : list.length === 0 ? (
            <div className="tf-empty">Belum ada data santri.</div>
          ) : (
            <table className="tf-table">
              <thead>
                <tr>
                  <th>Nama</th><th>NIS</th><th>Kelas</th><th>Level</th>
                  <th>Halaman Terakhir</th><th>Surah Terakhir</th>
                  {canEdit && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nama}</td>
                    <td>{s.nis || '-'}</td>
                    <td>{namaKelas(s.kelas_id)}</td>
                    <td>{s.level_ummi || '-'}</td>
                    <td>{s.halaman_terakhir}</td>
                    <td>{s.surah_terakhir}</td>
                    {canEdit && (
                      <td>{user.role === 'admin' && <button className="tf-btn-sm" onClick={() => hapus(s.id)}>Hapus</button>}</td>
                    )}
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
