import { NextRequest } from 'next/server';
import { requireAuth, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

const VALID_ROLES = ['admin', 'penyimak', 'santri', 'tamu'];

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa melihat daftar user');
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('users').select('id, nama, username, role, kelas_id, status').order('nama');
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menambah user');
  const payload = await req.json();

  const username = String(payload.username || '').trim();
  if (!username) throw new Error('Username wajib diisi');
  if (!VALID_ROLES.includes(payload.role)) throw new Error('Role tidak valid');

  const db = getSupabaseAdmin();
  const { data: existing } = await db.from('users').select('id').ilike('username', username).maybeSingle();
  if (existing) throw new Error('Username sudah dipakai');

  const passwordHash = await hashPassword(payload.password || '123456');
  const { data: row, error } = await db
    .from('users')
    .insert({
      nama: payload.nama,
      username,
      password_hash: passwordHash,
      role: payload.role,
      kelas_id: payload.kelas_id || null,
      status: 'aktif',
    })
    .select('id, nama, username, role, kelas_id, status')
    .single();
  if (error) throw new Error(error.message);
  return jsonOk({ data: row });
});
