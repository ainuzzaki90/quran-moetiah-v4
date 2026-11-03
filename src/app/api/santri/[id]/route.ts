import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const payload = await req.json();
  const db = getSupabaseAdmin();

  const updates: Record<string, any> = {};
  ['nama', 'nis', 'kelas_id', 'jenis_kelamin', 'tanggal_lahir', 'user_id', 'level_ummi'].forEach((f) => {
    if (payload[f] !== undefined) updates[f] = payload[f];
  });

  // Penghubung akun login siswa: hanya admin; akun harus ber-role Siswa dan belum dipakai siswa lain
  if (updates.user_id !== undefined) {
    if (session.role !== 'admin') {
      delete updates.user_id;
    } else if (!updates.user_id) {
      updates.user_id = null;
    } else {
      const [{ data: u }, { data: dipakai }] = await Promise.all([
        db.from('users').select('id, role').eq('id', updates.user_id).maybeSingle(),
        db.from('santri').select('id').eq('user_id', updates.user_id).neq('id', params.id).limit(1),
      ]);
      if (!u || u.role !== 'santri') throw new Error('Akun harus ber-role Siswa');
      if (dipakai && dipakai.length) throw new Error('Akun ini sudah terhubung ke siswa lain');
    }
  }

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
