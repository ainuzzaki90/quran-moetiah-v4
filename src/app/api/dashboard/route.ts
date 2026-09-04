import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { enrichSetoranRows } from '@/lib/enrich';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();

  const { data: setoranAll } = await db.from('setoran').select('*');
  const { data: santriAll } = await db.from('santri').select('*');
  let setoran = setoranAll || [];
  let santri = santriAll || [];

  if (session.role === 'penyimak') {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    setoran = setoran.filter((s) => binaanIds.includes(String(s.santri_id)));
    santri = santri.filter((s) => binaanIds.includes(String(s.id)));
  } else if (session.role === 'santri') {
    const me = santri.find((s) => String(s.user_id) === String(session.user_id));
    setoran = setoran.filter((s) => me && String(s.santri_id) === String(me.id));
    santri = me ? [me] : [];
  }

  const nilaiValid = setoran.map((s) => Number(s.nilai)).filter((n) => !isNaN(n));
  const rataNilai = nilaiValid.length ? nilaiValid.reduce((a, b) => a + b, 0) / nilaiValid.length : 0;

  const now = new Date();
  const bulanIni = setoran.filter((s) => {
    const d = new Date(s.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const terbaru = [...setoran].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).slice(0, 10);
  const terbaruEnriched = await enrichSetoranRows(terbaru);

  return jsonOk({
    stats: {
      total_setoran: setoran.length,
      total_santri: santri.length,
      rata_nilai: Math.round(rataNilai * 100) / 100,
      setoran_bulan_ini: bulanIni,
    },
    setoran_terbaru: terbaruEnriched,
  });
});
