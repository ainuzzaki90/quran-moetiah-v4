import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { parseHalaqahParam } from '@/lib/halaqah';
import { enrichSetoranRows } from '@/lib/enrich';
import { fetchAll } from '@/lib/db-utils';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const hq = parseHalaqahParam(req.nextUrl.searchParams.get('halaqah_id'));

  // Tentukan cakupan siswa (sesuai role) lebih dulu, lalu filter di database
  let scopeIds: number[] | null = null; // null = semua siswa
  if (session.role === 'penyimak') {
    scopeIds = (await getSantriIdsForPenyimak(session.user_id)).map(Number);
  } else if (session.role === 'santri') {
    const { data: me } = await db.from('santri').select('id').eq('user_id', session.user_id).maybeSingle();
    scopeIds = me ? [me.id] : [];
  }

  if (scopeIds && scopeIds.length === 0) {
    return jsonOk({ stats: { total_setoran: 0, total_santri: 0, rata_nilai: 0, setoran_bulan_ini: 0 }, setoran_terbaru: [] });
  }

  const applyScope = (q: any) => {
    if (scopeIds) q = q.in('santri_id', scopeIds);
    if (hq) q = q.eq('halaqah_id', hq);
    return q;
  };

  const [setoranRingkas, terbaru, totalSantri] = await Promise.all([
    fetchAll(() => applyScope(db.from('setoran').select('id, nilai, tanggal')).order('id')),
    applyScope(db.from('setoran').select('*')).order('tanggal', { ascending: false }).order('id', { ascending: false }).limit(10),
    scopeIds
      ? Promise.resolve(scopeIds.length)
      : db.from('santri').select('id', { count: 'exact', head: true }).then((r) => r.count || 0),
  ]);

  const nilaiValid = setoranRingkas.map((s: any) => Number(s.nilai)).filter((n: number) => !isNaN(n));
  const rataNilai = nilaiValid.length ? nilaiValid.reduce((a: number, b: number) => a + b, 0) / nilaiValid.length : 0;

  const now = new Date();
  const bulanIni = setoranRingkas.filter((s: any) => {
    const d = new Date(s.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return jsonOk({
    stats: {
      total_setoran: setoranRingkas.length,
      total_santri: totalSantri,
      rata_nilai: Math.round(rataNilai * 100) / 100,
      setoran_bulan_ini: bulanIni,
    },
    setoran_terbaru: await enrichSetoranRows(terbaru.data || []),
  });
});
