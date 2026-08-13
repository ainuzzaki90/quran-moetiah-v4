import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('kelas').select('*').order('nama_kelas');
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menambah kelas');
  const payload = await req.json();
  if (!payload.nama_kelas || !String(payload.nama_kelas).trim()) throw new Error('Nama kelas wajib diisi');

  const db = getSupabaseAdmin();
  const { data: row, error } = await db
    .from('kelas')
    .insert({ nama_kelas: String(payload.nama_kelas).trim(), penyimak_id: payload.penyimak_id || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return jsonOk({ data: row });
});
