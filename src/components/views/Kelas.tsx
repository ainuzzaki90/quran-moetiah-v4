'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useSortable } from '@/lib/use-sortable';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';
import type { User } from '../AppShell';

export default function KelasView({ user }: { user: User }) {
  const [list, setList] = useState<any[]>([]);
  const [penyimakList, setPenyimakList] = useState<any[]>([]);
  const [santriList, setSantriList] = useState<any[]>([]);
  const [namaKelas, setNamaKelas] = useState('');
  const [penyimakId, setPenyimakId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/kelas'), api.get('/users'), api.get('/santri')])
      .then(([k, u, s]) => {
        setList(k.data);
        setPenyimakList((u.data || []).filter((x: any) => x.role === 'penyimak'));
        setSantriList(s.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function namaPenyimak(id: number | null) {
    return penyimakList.find((p) => p.id === id)?.nama || '(belum ditentukan)';
  }

  const rowsForTable = list.map((k) => ({
    ...k,
    penyimak_nama: namaPenyimak(k.penyimak_id),
    jumlah_siswa: santriList.filter((s) => s.kelas_id === k.id).length,
  }));
  const { sorted, Th } = useSortable(rowsForTable);

  async function addKelas() {
    setError('');
    if (!namaKelas.trim()) { setError('Nama kelas wajib diisi'); return; }
    try {
      await api.post('/kelas', { nama_kelas: namaKelas.trim(), penyimak_id: penyimakId || null });
      setNamaKelas(''); setPenyimakId('');
      showToast('Kelas berhasil ditambahkan');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function ubahPenyimak(kelasId: number, newPenyimakId: string) {
    try {
      await api.put(`/kelas/${kelasId}`, { penyimak_id: newPenyimakId || null });
      showToast('Guru pengampu berhasil diperbarui');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function simpanEdit() {
    if (!editing) return;
    if (!editing.nama_kelas.trim()) { setError('Nama kelas wajib diisi'); return; }
    try {
      await api.put(`/kelas/${editing.id}`, { nama_kelas: editing.nama_kelas.trim(), penyimak_id: editing.penyimak_id || null });
      showToast('Perubahan berhasil disimpan');
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(id: number, nama: string) {
    if (!confirm(`Hapus kelas "${nama}"? Siswa di kelas ini tidak ikut terhapus.`)) return;
    try { await api.del(`/kelas/${id}`); showToast('Kelas berhasil dihapus'); load(); } catch (e: any) { setError(e.message); }
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
            <div className="tf-field">
              <label>Guru Pengampu (Penyimak)</label>
              <select value={penyimakId} onChange={(e) => setPenyimakId(e.target.value)}>
                <option value="">-- belum ditentukan --</option>
                {penyimakList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
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
              <thead>
                <tr>
                  <th>#</th>
                  <Th sortk="nama_kelas" label="Nama Kelas" />
                  <Th sortk="penyimak_nama" label="Guru Pengampu" />
                  <Th sortk="jumlah_siswa" label="Jumlah Siswa" />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((k, i) => (
                  <>
                    <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === k.id ? null : k.id)}>
                      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                      <td>{k.nama_kelas}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {user.role === 'admin' ? (
                          <select value={k.penyimak_id || ''} onChange={(e) => ubahPenyimak(k.id, e.target.value)}>
                            <option value="">-- belum ditentukan --</option>
                            {penyimakList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                          </select>
                        ) : k.penyimak_nama}
                      </td>
                      <td>{k.jumlah_siswa} siswa</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        {user.role === 'admin' && (
                          <>
                            <button className="tf-btn-icon" title="Edit" onClick={() => setEditing({ ...k })}>✏️</button>
                            <button className="tf-btn-icon tf-btn-icon-del" title="Hapus" onClick={() => hapus(k.id, k.nama_kelas)}>🗑</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expanded === k.id && (
                      <tr key={`${k.id}-detail`}>
                        <td colSpan={5} style={{ background: 'var(--surface-alt)' }}>
                          {k.jumlah_siswa === 0 ? 'Belum ada siswa di kelas ini.' : (
                            <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                              {santriList.filter((s) => s.kelas_id === k.id).map((s) => (
                                <li key={s.id}>{s.nama} — {s.level_ummi || '-'}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3>Edit Kelas</h3>
          <div className="tf-field">
            <label>Nama Kelas</label>
            <input value={editing.nama_kelas} onChange={(e) => setEditing({ ...editing, nama_kelas: e.target.value })} />
          </div>
          <div className="tf-field">
            <label>Guru Pengampu</label>
            <select value={editing.penyimak_id || ''} onChange={(e) => setEditing({ ...editing, penyimak_id: e.target.value })}>
              <option value="">-- belum ditentukan --</option>
              {penyimakList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
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
