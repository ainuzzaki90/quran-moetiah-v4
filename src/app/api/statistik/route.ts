import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { computeDateRange, computeCapaianTerakhir } from '@/lib/helpers';

// GET /api/statistik?periode=harian|pekanan|bulanan|tentatif&tanggal_referensi=&tanggal_mulai=&tanggal_selesai=&santri_id=&kelas_id=
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { start, end } = computeDateRange(params);

  const { data: setoranAllTime } = await db.from('setoran').select('*');
  let setoran = (setoranAllTime || []).filter((s) => {
    const d = new Date(s.tanggal);
    return d >= start && d <= end;
  });
  const { data: santriAll } = await db.from('santri').select('*');
  let santriScope = santriAll || [];

  if (session.role === 'penyimak') {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    setoran = setoran.filter((s) => binaanIds.includes(String(s.santri_id)));
    santriScope = santriScope.filter((s) => binaanIds.includes(String(s.id)));
  }
  if (session.role === 'santri') {
    const me = santriScope.find((s) => String(s.user_id) === String(session.user_id));
    setoran = setoran.filter((s) => me && String(s.santri_id) === String(me.id));
    santriScope = me ? [me] : [];
  }
  if (params.santri_id && params.santri_id !== 'all') {
    setoran = setoran.filter((s) => String(s.santri_id) === String(params.santri_id));
    santriScope = santriScope.filter((s) => String(s.id) === String(params.santri_id));
  }
  if (params.kelas_id) santriScope = santriScope.filter((s) => String(s.kelas_id) === String(params.kelas_id));

  const nilaiArr = setoran.map((s) => Number(s.nilai)).filter((n) => !isNaN(n));
  const rata = nilaiArr.length ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length : 0;

  const perHari: Record<string, number> = {};
  const perJenis: Record<string, number> = {};
  const perPredikat: Record<string, number> = {};
  setoran.forEach((s) => {
    const tglKey = new Date(s.tanggal).toISOString().substring(0, 10);
    perHari[tglKey] = (perHari[tglKey] || 0) + 1;
    perJenis[s.jenis] = (perJenis[s.jenis] || 0) + 1;
    if (s.predikat) perPredikat[s.predikat] = (perPredikat[s.predikat] || 0) + 1;
  });

  const { data: kelasAll } = await db.from('kelas').select('*');
  const peringkat = santriScope
    .map((santri) => {
      const rows = setoran.filter((s) => String(s.santri_id) === String(santri.id));
      const nilaiArrS = rows.map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
      const rataS = nilaiArrS.length ? nilaiArrS.reduce((a, b) => a + b, 0) / nilaiArrS.length : 0;
      const kelas = (kelasAll || []).find((k) => String(k.id) === String(santri.kelas_id));
      const rowsAllTime = (setoranAllTime || []).filter((s) => String(s.santri_id) === String(santri.id));
      const capaian = computeCapaianTerakhir(rowsAllTime as any);
      return {
        santri_id: santri.id,
        nama: santri.nama,
        kelas_nama: kelas ? kelas.nama_kelas : '',
        level_ummi: santri.level_ummi || '',
        total_setoran: rows.length,
        rata_nilai: Math.round(rataS * 100) / 100,
        halaman_terakhir: capaian.halaman ? capaian.halaman.label : '-',
        surah_terakhir: capaian.surah ? capaian.surah.label : '-',
      };
    })
    .sort((a, b) => b.rata_nilai - a.rata_nilai);

  return jsonOk({
    total_setoran: setoran.length,
    rata_nilai: Math.round(rata * 100) / 100,
    per_hari: perHari,
    per_jenis: perJenis,
    per_predikat: perPredikat,
    peringkat,
  });
});
