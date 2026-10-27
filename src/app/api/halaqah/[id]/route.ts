import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa mengubah halaqah');
  const p = await req.json();
  const updates: Record<string, any> = {};
  ['nama', 'jam_mulai', 'jam_selesai', 'urutan', 'masuk_rapor', 'aktif'].forEach((f) => {
    if (p[f] !== undefined) updates[f] = p[f] === '' ? null : p[f];
  });
  if (updates.nama !== undefined && !String(updates.nama || '').trim()) throw new Error('Nama halaqah wajib diisi');
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('halaqah').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message.includes('duplicate') ? 'Nama halaqah sudah ada' : error.message);
  if (!data || !data.length) throw new Error('Halaqah tidak ditemukan');
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menghapus halaqah');
  const db = getSupabaseAdmin();
  const { data: used } = await db.from('setoran').select('id').eq('halaqah_id', params.id).limit(1);
  const { data: usedP } = await db.from('presensi').select('id').eq('halaqah_id', params.id).limit(1);
  if ((used && used.length) || (usedP && usedP.length)) {
    throw new Error('Halaqah ini sudah punya data setoran/presensi. Nonaktifkan saja, jangan dihapus.');
  }
  const { error } = await db.from('halaqah').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  return jsonOk();
});
