import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hitungNilaiAspek, calcPredikat, JENIS_PAKAI_ASPEK } from '@/lib/helpers';
import { getPengaturan } from '@/lib/pengaturan';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { logAudit, namaSiswa, bedaField, ringkasSetoran } from '@/lib/audit';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const payload = await req.json();
  const db = getSupabaseAdmin();
  const { data: lama } = await db.from('setoran').select('*').eq('id', params.id).maybeSingle();

  const updates: Record<string, any> = {};
  [
    'nilai', 'predikat', 'jenis', 'catatan', 'halaman_mulai', 'halaman_selesai',
    'surah', 'surah_selesai', 'ayat_mulai', 'ayat_selesai',
    'nilai_tajwid', 'nilai_fashohah', 'nilai_kelancaran', 'halaqah_id',
  ].forEach((f) => {
    if (payload[f] !== undefined) updates[f] = payload[f];
  });

  // Jika ke-4 skor aspek dikirim, nilai dihitung ulang di server
  if (payload.skor) {
    const { data: cur } = await db.from('setoran').select('jenis').eq('id', params.id).maybeSingle();
    if (!cur) throw new Error('Data setoran tidak ditemukan');
    if (JENIS_PAKAI_ASPEK.includes(cur.jenis)) {
      const { bobot } = await getPengaturan();
      const n = hitungNilaiAspek(payload.skor, bobot);
      if (n === null) throw new Error('Nilai 4 aspek wajib diisi semua');
      updates.nilai = n;
      updates.predikat = calcPredikat(n);
      updates.nilai_makharij = Number(payload.skor.makharij);
      updates.nilai_tajwid = Number(payload.skor.tajwid);
      updates.nilai_kelancaran = Number(payload.skor.kelancaran);
      updates.nilai_ketepatan = Number(payload.skor.ketepatan);
    }
  }

  const { data, error } = await db.from('setoran').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Data setoran tidak ditemukan');
  if (lama) {
    const { data: baru } = await db.from('setoran').select('*').eq('id', params.id).maybeSingle();
    const d = bedaField(lama, baru || {}, ['jenis', 'surah', 'surah_selesai', 'ayat_mulai', 'ayat_selesai', 'halaman_mulai', 'halaman_selesai', 'nilai', 'predikat', 'nilai_makharij', 'nilai_tajwid', 'nilai_kelancaran', 'nilai_ketepatan', 'nilai_fashohah', 'catatan', 'halaqah_id']);
    if (d.berubah) {
      const ring = Object.keys(d.sebelum).map((k) => `${k}: ${d.sebelum[k] ?? '-'} → ${d.sesudah[k] ?? '-'}`).join('; ');
      await logAudit(session, { aksi: 'setoran.ubah', objek_id: params.id, santri_id: lama.santri_id, santri_nama: await namaSiswa(lama.santri_id), ringkasan: `${lama.jenis}: ${ring}`, sebelum: d.sebelum, sesudah: d.sesudah });
    }
  }
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();

  if (session.role === 'penyimak') {
    const { data: row } = await db.from('setoran').select('penyimak_id').eq('id', params.id).maybeSingle();
    if (!row) throw new Error('Data setoran tidak ditemukan');
    if (String(row.penyimak_id) !== String(session.user_id)) throw new Error('Tidak berhak menghapus setoran ini');
  }

  const { data: lama } = await db.from('setoran').select('*').eq('id', params.id).maybeSingle();
  const { error } = await db.from('setoran').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  if (lama) await logAudit(session, { aksi: 'setoran.hapus', objek_id: params.id, santri_id: lama.santri_id, santri_nama: await namaSiswa(lama.santri_id), ringkasan: ringkasSetoran(lama), sebelum: lama });
  return jsonOk();
});
