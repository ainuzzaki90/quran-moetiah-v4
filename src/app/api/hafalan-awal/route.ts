import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { isSantriBinaanPenyimak } from '@/lib/relations';

// GET /api/hafalan-awal?santri_id=  -> daftar nomor surat hafalan awal
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const santriId = req.nextUrl.searchParams.get('santri_id');
  if (!santriId) throw new Error('santri_id wajib diisi');
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('hafalan_awal').select('surah_no').eq('santri_id', santriId);
  if (error) throw new Error(error.message);
  return jsonOk({ data: (data || []).map((r) => r.surah_no) });
});

// POST /api/hafalan-awal { santri_id, surah_list: [114, 113, ...] }  -> replace
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const p = await req.json();
  if (!p.santri_id) throw new Error('santri_id wajib diisi');
  if (session.role === 'penyimak' && !(await isSantriBinaanPenyimak(Number(p.santri_id), session.user_id))) {
    throw new Error('Siswa ini bukan binaan Anda');
  }
  const list: number[] = Array.from(new Set<number>((p.surah_list || []).map(Number).filter((n: number) => n >= 1 && n <= 114)));
  const db = getSupabaseAdmin();
  await db.from('hafalan_awal').delete().eq('santri_id', p.santri_id);
  if (list.length) {
    const { error } = await db.from('hafalan_awal').insert(list.map((n) => ({ santri_id: p.santri_id, surah_no: n })));
    if (error) throw new Error(error.message);
  }
  return jsonOk({ count: list.length });
});
