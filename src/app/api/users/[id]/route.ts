import { NextRequest } from 'next/server';
import { requireAuth, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa mengubah data pengguna');
  const payload = await req.json();

  const updates: Record<string, any> = {};
  ['nama', 'role', 'kelas_id', 'status'].forEach((f) => {
    if (payload[f] !== undefined) updates[f] = payload[f];
  });
  // Reset password (opsional, minimal 6 karakter) lewat endpoint yang sama
  if (payload.password) {
    if (String(payload.password).length < 6) throw new Error('Password baru minimal 6 karakter');
    updates.password_hash = await hashPassword(payload.password);
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('users').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Pengguna tidak ditemukan');
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menghapus pengguna');
  const db = getSupabaseAdmin();
  const { error } = await db.from('users').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  return jsonOk();
});
