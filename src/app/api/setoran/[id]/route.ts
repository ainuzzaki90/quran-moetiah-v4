import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireAuth(getToken(req));
  const payload = await req.json();
  const db = getSupabaseAdmin();

  const updates: Record<string, any> = {};
  [
    'nilai', 'predikat', 'jenis', 'catatan', 'halaman_mulai', 'halaman_selesai',
    'surah', 'surah_selesai', 'ayat_mulai', 'ayat_selesai',
    'nilai_tajwid', 'nilai_fashohah', 'nilai_kelancaran',
  ].forEach((f) => {
    if (payload[f] !== undefined) updates[f] = payload[f];
  });

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
