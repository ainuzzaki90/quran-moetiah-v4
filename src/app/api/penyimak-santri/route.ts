import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseHalaqahParam, getDefaultHalaqahId } from '@/lib/halaqah';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

// GET /api/penyimak-santri?penyimak_id=  (admin bebas pilih; penyimak selalu lihat binaannya sendiri)
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const penyimakIdParam = req.nextUrl.searchParams.get('penyimak_id');
  const halaqahParam = parseHalaqahParam(req.nextUrl.searchParams.get('halaqah_id'));

  if (session.role === 'admin') {
    let query = db.from('penyimak_santri').select('*');
    if (penyimakIdParam) query = query.eq('penyimak_id', penyimakIdParam);
    if (halaqahParam) query = query.eq('halaqah_id', halaqahParam);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return jsonOk({ data });
  }
  if (session.role === 'penyimak') {
    let q2 = db.from('penyimak_santri').select('*').eq('penyimak_id', session.user_id);
    if (halaqahParam) q2 = q2.eq('halaqah_id', halaqahParam);
    const { data, error } = await q2;
    if (error) throw new Error(error.message);
    return jsonOk({ data });
  }
  throw new Error('Tidak diizinkan');
});

// POST /api/penyimak-santri  { penyimak_id, halaqah_id, santri_ids: [...] } -- replace (per halaqah), bukan tambah. Admin only.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa mengatur binaan penyimak');
  const payload = await req.json();
  const penyimakId = payload.penyimak_id;
  if (!penyimakId) throw new Error('penyimak_id wajib diisi');
  const santriIds: number[] = payload.santri_ids || [];

  const halaqahId = payload.halaqah_id || (await getDefaultHalaqahId());
  if (!halaqahId) throw new Error('Halaqah belum ada. Jalankan migrasi halaqah di Supabase.');

  const db = getSupabaseAdmin();
  await db.from('penyimak_santri').delete().eq('penyimak_id', penyimakId).eq('halaqah_id', halaqahId);
  if (santriIds.length) {
    const { error } = await db.from('penyimak_santri').insert(
      santriIds.map((sid) => ({ penyimak_id: penyimakId, santri_id: sid, halaqah_id: halaqahId }))
    );
    if (error) throw new Error(error.message);
  }
  return jsonOk({ count: santriIds.length });
});
