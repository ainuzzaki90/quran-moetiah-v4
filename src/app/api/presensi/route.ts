import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

// GET /api/presensi?santri_id=&tanggal_mulai=&tanggal_akhir=&penyimak_id=(admin only)
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;

  let query = db.from('presensi').select('*').order('tanggal', { ascending: false });

  if (session.role === 'penyimak') query = query.eq('penyimak_id', session.user_id);
  if (session.role === 'admin' && params.get('penyimak_id')) query = query.eq('penyimak_id', params.get('penyimak_id'));
  if (params.get('santri_id')) query = query.eq('santri_id', params.get('santri_id'));
  if (params.get('tanggal_mulai')) query = query.gte('tanggal', params.get('tanggal_mulai')!);
  if (params.get('tanggal_akhir')) query = query.lte('tanggal', params.get('tanggal_akhir')!);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});

// POST /api/presensi  { tanggal, materi?, catatan?, penyimak_id?(admin only), rows: [{santri_id, kelas_id, status}] }
// Replace: menghapus data presensi lama pada tanggal+penyimak yang sama, lalu insert baru.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const payload = await req.json();
  if (!payload.tanggal) throw new Error('tanggal wajib diisi');
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw new Error('Data presensi kosong');

  const effectivePenyimakId = session.role === 'admin' && payload.penyimak_id ? payload.penyimak_id : session.user_id;

  const db = getSupabaseAdmin();
  await db.from('presensi').delete().eq('tanggal', payload.tanggal).eq('penyimak_id', effectivePenyimakId);

  const rows = payload.rows.map((item: any) => ({
    tanggal: payload.tanggal,
    kelas_id: item.kelas_id || null,
    penyimak_id: effectivePenyimakId,
    santri_id: item.santri_id,
    status: item.status || 'Hadir',
    materi: payload.materi || null,
    catatan: payload.catatan || null,
  }));
  const { error } = await db.from('presensi').insert(rows);
  if (error) throw new Error(error.message);
  return jsonOk();
});

// DELETE /api/presensi  { tanggal, penyimak_id?(admin only) } -- dikirim sebagai body JSON
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const payload = await req.json();
  if (!payload.tanggal) throw new Error('tanggal wajib diisi');
  const effectivePenyimakId = session.role === 'admin' && payload.penyimak_id ? payload.penyimak_id : session.user_id;

  const db = getSupabaseAdmin();
  const { error } = await db.from('presensi').delete().eq('tanggal', payload.tanggal).eq('penyimak_id', effectivePenyimakId);
  if (error) throw new Error(error.message);
  return jsonOk();
});
