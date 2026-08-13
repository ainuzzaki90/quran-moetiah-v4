'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '../AppShell';

export default function KelasView({ user }: { user: User }) {
  const [list, setList] = useState<any[]>([]);
  const [namaKelas, setNamaKelas] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/kelas').then((res) => setList(res.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addKelas() {
    setError('');
    if (!namaKelas.trim()) { setError('Nama kelas wajib diisi'); return; }
    try {
      await api.post('/kelas', { nama_kelas: namaKelas.trim() });
      setNamaKelas('');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number) {
    if (!confirm('Hapus kelas ini?')) return;
    try { await api.del(`/kelas/${id}`); load(); } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="tf-title">Data Kelas</h1>
      {error && <div className="tf-error">{error}</div>}

      {user.role === 'admin' && (
        <div className="tf-panel">
          <div className="tf-panel-head">Tambah Kelas</div>
          <div className="tf-panel-body">
            <div className="tf-field">
              <label>Nama Kelas</label>
              <input value={namaKelas} onChange={(e) => setNamaKelas(e.target.value)} placeholder="Contoh: VII A" />
            </div>
            <button className="tf-btn" onClick={addKelas}>Tambah</button>
          </div>
        </div>
      )}

      <div className="tf-panel">
        <div className="tf-panel-head">Daftar Kelas</div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : list.length === 0 ? (
            <div className="tf-empty">Belum ada data kelas.</div>
          ) : (
            <table className="tf-table">
              <thead><tr><th>Nama Kelas</th>{user.role === 'admin' && <th>Aksi</th>}</tr></thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k.id}>
                    <td>{k.nama_kelas}</td>
                    {user.role === 'admin' && (
                      <td><button className="tf-btn-sm" onClick={() => hapus(k.id)}>Hapus</button></td>
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
