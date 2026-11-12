import { NextRequest } from 'next/server';
import { requireAuth, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { logAudit, bedaField } from '@/lib/audit';

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
  const { data: lama } = await db.from('users').select('nama, username, role, kelas_id, status').eq('id', params.id).maybeSingle();
  const { data, error } = await db.from('users').update(updates).eq('id', params.id).select('id');
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Pengguna tidak ditemukan');
  if (lama) {
    const { password_hash: _x, ...tanpaPw } = updates;
    const d = bedaField(lama, { ...lama, ...tanpaPw });
    const ident = `${lama.nama} (${lama.username})`;
    if (d.berubah) await logAudit(session, { aksi: 'pengguna.ubah', objek_id: params.id, ringkasan: `${ident}: ${Object.keys(d.sebelum).map((k) => `${k}: ${d.sebelum[k] ?? '-'} → ${d.sesudah[k] ?? '-'}`).join('; ')}`, sebelum: d.sebelum, sesudah: d.sesudah });
    if (payload.password) await logAudit(session, { aksi: 'pengguna.password', objek_id: params.id, ringkasan: `Password ${ident} direset oleh admin` });
  }
  return jsonOk();
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menghapus pengguna');
  const db = getSupabaseAdmin();
  const { data: lama } = await db.from('users').select('nama, username, role, kelas_id, status').eq('id', params.id).maybeSingle();
  const { error } = await db.from('users').delete().eq('id', params.id);
  if (error) throw new Error(error.message);
  if (lama) await logAudit(session, { aksi: 'pengguna.hapus', objek_id: params.id, ringkasan: `${lama.nama} (${lama.username}) · peran ${lama.role}`, sebelum: lama });
  return jsonOk();
});
