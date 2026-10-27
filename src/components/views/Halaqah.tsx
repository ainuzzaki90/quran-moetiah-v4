'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import Modal from '../Modal';
import type { User } from '../AppShell';

const EMPTY = { nama: '', jam_mulai: '', jam_selesai: '', urutan: 1, masuk_rapor: true, aktif: true };

export default function HalaqahView({ user }: { user: User }) {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null); // null = tertutup

  function load() {
    setLoading(true);
    api.get('/halaqah').then((r) => setList(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function simpan() {
    setError('');
    try {
      const body = { ...form, urutan: Number(form.urutan) || 1 };
      if (form.id) await api.put(`/halaqah/${form.id}`, body);
      else await api.post('/halaqah', body);
      showToast('Halaqah berhasil disimpan');
      setForm(null); load();
    } catch (e: any) { setError(e.message); }
  }

  async function hapus(h: any) {
    if (!confirm(`Hapus ${h.nama}?`)) return;
    try { await api.del(`/halaqah/${h.id}`); showToast('Halaqah dihapus'); load(); } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="tf-title">Data Halaqah</h1>
      {error && <div className="tf-error">{error}</div>}
      <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
        Halaqah dipakai di Setoran, Presensi, dan laporan. Halaqah yang <b>tidak masuk rapor</b> nilainya dicatat terpisah
        (tidak dicampur ke rata-rata rapor utama). Guru pengampu tiap halaqah diatur di menu <b>Pengguna → Siswa Binaan</b>.
      </div>
      <div className="tf-panel">
        <div className="tf-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Daftar Halaqah</span>
          <button className="tf-btn-sm" onClick={() => setForm({ ...EMPTY, urutan: list.length + 1 })}>+ Tambah Halaqah</button>
        </div>
        <div className="tf-panel-body tf-table-wrap">
          {loading ? <div className="tf-empty">Memuat...</div> : (
            <table className="tf-table">
              <thead><tr><th>Urutan</th><th>Nama</th><th>Jam</th><th>Nilai di Rapor Utama</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.id}>
                    <td>{h.urutan}</td>
                    <td><b>{h.nama}</b></td>
                    <td>{h.jam_mulai ? `${h.jam_mulai}${h.jam_selesai ? ' – ' + h.jam_selesai : ''}` : '-'}</td>
                    <td>{h.masuk_rapor ? 'Ya' : 'Tidak (dicatat terpisah)'}</td>
                    <td>{h.aktif ? 'Aktif' : 'Nonaktif'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="tf-btn-icon" title="Edit" onClick={() => setForm({ ...h, jam_mulai: h.jam_mulai || '', jam_selesai: h.jam_selesai || '' })}>✏️</button>
                      <button className="tf-btn-icon tf-btn-icon-del" title="Hapus" onClick={() => hapus(h)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <h3>{form.id ? 'Edit Halaqah' : 'Tambah Halaqah'}</h3>
          <div className="tf-field"><label>Nama Halaqah</label>
            <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></div>
          <div className="tf-field"><label>Jam Mulai</label>
            <input type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} /></div>
          <div className="tf-field"><label>Jam Selesai</label>
            <input type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} /></div>
          <div className="tf-field"><label>Urutan</label>
            <input type="number" min={1} value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input type="checkbox" checked={form.masuk_rapor} onChange={(e) => setForm({ ...form, masuk_rapor: e.target.checked })} />
            Nilai dihitung di rapor utama
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            Aktif
          </label>
          <div className="tf-modal-actions">
            <button className="tf-btn tf-btn-secondary" onClick={() => setForm(null)}>Batal</button>
            <button className="tf-btn" onClick={simpan}>Simpan</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
