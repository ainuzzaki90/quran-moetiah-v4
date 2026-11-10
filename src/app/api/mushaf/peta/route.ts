import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { fetchAll, SETORAN_HAFALAN_COLS } from '@/lib/db-utils';
import { computeHafalan } from '@/lib/hafalan';

// GET /api/mushaf/peta?santri_id=  -> status 604 halaman (0 belum, 1 sebagian, 2 penuh).
// Role Siswa selalu melihat miliknya sendiri; admin/guru/tamu memilih siswa.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  let q = db.from('santri').select('id, nama');
  if (session.role === 'santri') q = q.eq('user_id', session.user_id);
  else {
    const id = Number(req.nextUrl.searchParams.get('santri_id'));
    if (!id) throw new Error('santri_id wajib diisi');
    q = q.eq('id', id);
  }
  const { data: s, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error('Siswa tidak ditemukan');

  const [setoran, awalRes] = await Promise.all([
    fetchAll<any>(() => db.from('setoran').select(SETORAN_HAFALAN_COLS).eq('santri_id', s.id).eq('jenis', 'Hafalan Baru').order('id')),
    db.from('hafalan_awal').select('surah_no').eq('santri_id', s.id),
  ]);
  const h = computeHafalan(setoran, (awalRes.data || []).map((a) => a.surah_no), true);
  const st: number[] = (h as any).halaman_status;
  return jsonOk({
    santri_id: s.id, nama: s.nama, halaman: st,
    penuh: st.filter((x) => x === 2).length, sebagian: st.filter((x) => x === 1).length,
    hafalan_tertinggi_label: h.hafalan_tertinggi_label,
  });
});
