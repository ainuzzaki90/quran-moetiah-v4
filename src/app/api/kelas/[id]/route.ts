import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa mengubah data kelas');
  const payload = await req.json();

  const updates: Record<string, any> = {};
  if (payload.nama_kelas !== undefined) updates.nama_kelas = payload.nama_kelas;
  if (payload.penyimak_id !== undefined) updates.penyimak_id = payload.penyimak_id;

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('kelas').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Kelas tidak ditemukan');
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menghapus kelas');
  const db = getSupabaseAdmin();
  const { error } = await db.from('kelas').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  return jsonOk();
});
