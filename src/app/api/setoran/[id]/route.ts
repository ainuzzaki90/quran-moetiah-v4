import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hitungNilaiAspek, calcPredikat, JENIS_PAKAI_ASPEK } from '@/lib/helpers';
import { getPengaturan } from '@/lib/pengaturan';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireAuth(getToken(req));
  const payload = await req.json();
  const db = getSupabaseAdmin();

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

  const { error } = await db.from('setoran').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  return jsonOk();
});
