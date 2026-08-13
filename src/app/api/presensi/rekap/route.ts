import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

// GET /api/presensi/rekap?penyimak_id=&kelas_id=&tanggal_mulai=&tanggal_akhir=&show_all=1
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;

  let query = db.from('presensi').select('*');
  if (session.role === 'penyimak') query = query.eq('penyimak_id', session.user_id);
  if (params.get('penyimak_id')) query = query.eq('penyimak_id', params.get('penyimak_id'));
  if (params.get('kelas_id')) query = query.eq('kelas_id', params.get('kelas_id'));
  if (params.get('tanggal_mulai')) query = query.gte('tanggal', params.get('tanggal_mulai')!);
  if (params.get('tanggal_akhir')) query = query.lte('tanggal', params.get('tanggal_akhir')!);

  const { data: presensi, error } = await query;
  if (error) throw new Error(error.message);

  const { data: santriList } = await db.from('santri').select('id, nama, nis, kelas_id, level_ummi');
  const { data: kelasList } = await db.from('kelas').select('id, nama_kelas');
  const kelasMap: Record<string, string> = {};
  (kelasList || []).forEach((k) => { kelasMap[String(k.id)] = k.nama_kelas; });

  const map: Record<string, { hadir: number; izin: number; sakit: number; alfa: number }> = {};
  (presensi || []).forEach((r) => {
    const sid = String(r.santri_id);
    if (!map[sid]) map[sid] = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    const st = (r.status || 'Hadir').toLowerCase();
    if (st === 'hadir') map[sid].hadir++;
    else if (st === 'izin') map[sid].izin++;
    else if (st === 'sakit') map[sid].sakit++;
    else map[sid].alfa++;
  });

  const showAll = params.get('show_all');
  let result = (santriList || []).map((s) => {
    const sid = String(s.id);
    const rec = map[sid] || { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    const total = rec.hadir + rec.izin + rec.sakit + rec.alfa;
    return {
      santri_id: sid,
      nama: s.nama,
      nis: s.nis,
      kelas_nama: kelasMap[String(s.kelas_id)] || '-',
      level_ummi: s.level_ummi || '-',
      ...rec,
      total,
      pct_hadir: total > 0 ? Math.round((rec.hadir / total) * 100) : 0,
    };
  });
  if (!showAll) result = result.filter((r) => r.total > 0);
  result.sort((a, b) => b.hadir - a.hadir);

  return jsonOk({ data: result });
});
