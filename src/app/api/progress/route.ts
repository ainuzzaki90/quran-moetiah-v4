import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { isSantriBinaanPenyimak } from '@/lib/relations';
import { computeCapaianTerakhir } from '@/lib/helpers';

// GET /api/progress?santri_id=&tanggal_mulai=&tanggal_akhir=  (default rentang: 90 hari terakhir)
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;

  let santriId: string | null = params.get('santri_id');
  if (session.role === 'santri') {
    const { data: me } = await db.from('santri').select('id').eq('user_id', session.user_id).maybeSingle();
    if (!me) throw new Error('Akun ini belum terhubung ke data santri');
    santriId = String(me.id);
  } else if (session.role === 'penyimak') {
    if (!santriId) throw new Error('santri_id wajib diisi');
    if (!(await isSantriBinaanPenyimak(Number(santriId), session.user_id))) throw new Error('Siswa ini bukan binaan Anda');
  } else if (!santriId) {
    throw new Error('santri_id wajib diisi');
  }

  const { data: santri } = await db.from('santri').select('*').eq('id', santriId).maybeSingle();
  if (!santri) throw new Error('Data santri tidak ditemukan');
  const { data: kelas } = await db.from('kelas').select('nama_kelas').eq('id', santri.kelas_id).maybeSingle();

  const end = params.get('tanggal_akhir') ? new Date(params.get('tanggal_akhir') + 'T23:59:59') : new Date();
  const start = params.get('tanggal_mulai')
    ? new Date(params.get('tanggal_mulai')!)
    : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

  const { data: setoranSantri } = await db.from('setoran').select('*').eq('santri_id', santriId);
  const setoran = (setoranSantri || [])
    .filter((s) => { const d = new Date(s.tanggal); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  const nilaiTrend = setoran
    .filter((s) => !isNaN(Number(s.nilai)))
    .map((s) => ({ tanggal: s.tanggal, nilai: Number(s.nilai), jenis: s.jenis, predikat: s.predikat }));

  const semuaNilai = nilaiTrend.map((n) => n.nilai);
  const rataKeseluruhan = semuaNilai.length ? semuaNilai.reduce((a, b) => a + b, 0) / semuaNilai.length : 0;

  let tren = 'stabil', deltaNilai = 0, rataAwal = 0, rataAkhir = 0;
  if (nilaiTrend.length >= 4) {
    const tengah = Math.floor(nilaiTrend.length / 2);
    const paruhAwal = nilaiTrend.slice(0, tengah).map((n) => n.nilai);
    const paruhAkhir = nilaiTrend.slice(tengah).map((n) => n.nilai);
    rataAwal = paruhAwal.reduce((a, b) => a + b, 0) / paruhAwal.length;
    rataAkhir = paruhAkhir.reduce((a, b) => a + b, 0) / paruhAkhir.length;
    deltaNilai = rataAkhir - rataAwal;
    if (deltaNilai >= 1) tren = 'naik';
    else if (deltaNilai <= -1) tren = 'turun';
  }

  const perMinggu: Record<string, { total: number; count: number }> = {};
  nilaiTrend.forEach((n) => {
    const d = new Date(n.tanggal);
    const awalPekan = new Date(d);
    const hari = awalPekan.getDay();
    awalPekan.setDate(awalPekan.getDate() - (hari === 0 ? 6 : hari - 1));
    const key = awalPekan.toISOString().substring(0, 10);
    if (!perMinggu[key]) perMinggu[key] = { total: 0, count: 0 };
    perMinggu[key].total += n.nilai;
    perMinggu[key].count += 1;
  });
  const rataPerMinggu: Record<string, number> = {};
  Object.keys(perMinggu).sort().forEach((k) => {
    rataPerMinggu[k] = Math.round((perMinggu[k].total / perMinggu[k].count) * 100) / 100;
  });

  const { data: presensiSantri } = await db.from('presensi').select('*').eq('santri_id', santriId);
  const presensi = (presensiSantri || []).filter((p) => { const d = new Date(p.tanggal); return d >= start && d <= end; });

  const hadirCount = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
  presensi.forEach((p) => {
    const st = (p.status || 'Hadir').toLowerCase();
    if (st === 'hadir') hadirCount.hadir++;
    else if (st === 'izin') hadirCount.izin++;
    else if (st === 'sakit') hadirCount.sakit++;
    else hadirCount.alfa++;
  });
  const totalPresensi = hadirCount.hadir + hadirCount.izin + hadirCount.sakit + hadirCount.alfa;
  const pctHadir = totalPresensi > 0 ? Math.round((hadirCount.hadir / totalPresensi) * 100) : null;

  const capaian = computeCapaianTerakhir((setoranSantri || []) as any);

  return jsonOk({
    santri: { id: santri.id, nama: santri.nama, kelas_nama: kelas ? kelas.nama_kelas : '-', level_ummi: santri.level_ummi || '-' },
    rentang: { mulai: start.toISOString().substring(0, 10), akhir: end.toISOString().substring(0, 10) },
    total_setoran: setoran.length,
    rata_nilai: Math.round(rataKeseluruhan * 100) / 100,
    tren: { arah: tren, delta: Math.round(deltaNilai * 100) / 100, rata_awal: Math.round(rataAwal * 100) / 100, rata_akhir: Math.round(rataAkhir * 100) / 100 },
    halaman_terakhir: capaian.halaman,
    surah_terakhir: capaian.surah,
    nilai_per_minggu: rataPerMinggu,
    nilai_trend: nilaiTrend,
    kehadiran: { ...hadirCount, total: totalPresensi, pct_hadir: pctHadir },
  });
});
