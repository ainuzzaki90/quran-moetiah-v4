import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireAuth(getToken(req));
  const payload = await req.json();
  const db = getSupabaseAdmin();

  const updates: Record<string, any> = {};
  ['nama', 'nis', 'kelas_id', 'jenis_kelamin', 'tanggal_lahir', 'user_id', 'level_ummi'].forEach((f) => {
    if (payload[f] !== undefined) updates[f] = payload[f];
  });

  const { data, error } = await db.from('santri').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Data santri tidak ditemukan');
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menghapus data santri');
  const db = getSupabaseAdmin();
  const { error } = await db.from('santri').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  return jsonOk();
});
