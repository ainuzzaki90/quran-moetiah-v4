'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { SURAH_PAGES } from '@/lib/surah-pages';
import Modal from './Modal';

export default function HafalanAutoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [pilih, setPilih] = useState<Record<number, boolean>>({});
  const [sampai, setSampai] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hafalan-awal/auto')
      .then((r) => {
        setRows(r.data);
        const p: Record<number, boolean> = {}; const s: Record<number, number> = {};
        r.data.forEach((x: any) => { p[x.santri_id] = x.berubah; s[x.santri_id] = x.sampai_no; });
        setPilih(p); setSampai(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const jumlahDipilih = rows.filter((r) => pilih[r.santri_id]).length;

  async function simpan() {
    setSaving(true); setError('');
    try {
      const items = rows.filter((r) => pilih[r.santri_id]).map((r) => ({ santri_id: r.santri_id, sampai_no: sampai[r.santri_id] }));
      await api.post('/hafalan-awal/auto', { items });
      showToast(`Hafalan awal ${items.length} siswa berhasil disimpan`);
      onDone();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Isi Hafalan Awal Otomatis</h3>
      <p className="tf-empty" style={{ textAlign: 'left' }}>
        Surat terjauh yang pernah disetor siswa (Hafalan Baru) dianggap batas hafalan, sehingga semua surat dari <b>An-Nas sampai batas itu</b> dianggap hafal.
        Jika surat batas belum disetor sampai ayat terakhir, batas mundur satu surat. Periksa dulu, ubah batas bila perlu, lalu simpan.
        Data hafalan awal yang sudah ada tidak dihapus.
      </p>
      {error && <div className="tf-error">{error}</div>}
      {loading ? <div className="tf-empty">Memuat usulan...</div> : rows.length === 0 ? (
        <div className="tf-empty">Belum ada siswa dengan setoran Hafalan Baru.</div>
      ) : (
        <div className="tf-table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table className="tf-table">
            <thead><tr><th></th><th>Nama</th><th>Kelas</th><th>Surat Terjauh</th><th>Sekarang</th><th>Batas Hafalan (An-Nas → ...)</th><th>Hasil</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const to = sampai[r.santri_id] ?? r.sampai_no;
                const hasil = 114 - to + 1;
                return (
                  <tr key={r.santri_id} style={{ opacity: r.berubah ? 1 : 0.6 }}>
                    <td><input type="checkbox" checked={!!pilih[r.santri_id]} onChange={(e) => setPilih({ ...pilih, [r.santri_id]: e.target.checked })} /></td>
                    <td>{r.nama}</td>
                    <td>{r.kelas_nama}</td>
                    <td>{r.surat_terjauh}{r.surat_terjauh_penuh ? '' : ' (sebagian)'}</td>
                    <td style={{ textAlign: 'center' }}>{r.sekarang_berurutan}</td>
                    <td>
                      <select value={to} onChange={(e) => setSampai({ ...sampai, [r.santri_id]: Number(e.target.value) })}>
                        {[...SURAH_PAGES].reverse().map((s) => <option key={s[0]} value={s[0]}>{s[0]}. {s[1]}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{Math.max(hasil, r.sekarang_berurutan)} surat</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="tf-modal-actions">
        <button className="tf-btn tf-btn-secondary" onClick={onClose}>Batal</button>
        <button className="tf-btn" disabled={saving || jumlahDipilih === 0} onClick={simpan}>
          {saving ? 'Menyimpan...' : `Simpan ${jumlahDipilih} siswa`}
        </button>
      </div>
    </Modal>
  );
}
