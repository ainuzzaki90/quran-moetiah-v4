import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { fetchAll, SETORAN_HAFALAN_COLS } from '@/lib/db-utils';
import { getPengaturan } from '@/lib/pengaturan';
import { computeHafalan } from '@/lib/hafalan';

// GET /api/dashboard/prestasi -> papan prestasi (poin & hafalan tertinggi). Dimuat terpisah karena perhitungannya lebih berat.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role === 'santri') return jsonOk({ top_poin: null, per_kelas: null });
  const db = getSupabaseAdmin();

  let santriQ = db.from('santri').select('id, nama, kelas_id');
  let scopeIds: number[] | null = null;
  if (session.role === 'penyimak') {
    scopeIds = (await getSantriIdsForPenyimak(session.user_id)).map(Number);
    if (!scopeIds.length) return jsonOk({ top_poin: [], per_kelas: [] });
    santriQ = santriQ.in('id', scopeIds);
  }
  const [santriRes, kelasRes, awalRes, setoran, pengaturan] = await Promise.all([
    santriQ, db.from('kelas').select('id, nama_kelas'),
    db.from('hafalan_awal').select('santri_id, surah_no'),
    fetchAll<any>(() => {
      let q = db.from('setoran').select(SETORAN_HAFALAN_COLS).eq('jenis', 'Hafalan Baru');
      if (scopeIds) q = q.in('santri_id', scopeIds);
      return q.order('id');
    }),
    getPengaturan(),
  ]);
  const kelasNama: Record<string, string> = {}; (kelasRes.data || []).forEach((k) => { kelasNama[String(k.id)] = k.nama_kelas; });
  const awalMap: Record<string, number[]> = {};
  (awalRes.data || []).forEach((a) => { (awalMap[String(a.santri_id)] = awalMap[String(a.santri_id)] || []).push(a.surah_no); });
  const by: Record<string, any[]> = {};
  setoran.forEach((r) => { (by[String(r.santri_id)] = by[String(r.santri_id)] || []).push(r); });

  const hasil = (santriRes.data || []).map((s) => {
    const h = computeHafalan(by[String(s.id)] || [], awalMap[String(s.id)] || []);
    return {
      santri_id: s.id, nama: s.nama, kelas: kelasNama[String(s.kelas_id)] || '(tanpa kelas)',
      halaman_hafal: h.halaman_hafal, poin: Math.round(h.halaman_hafal * pengaturan.poin_per_halaman * 100) / 100,
      surat_hafal: h.surat_hafal, total_ayat: h.total_ayat, hafalan_tertinggi: h.hafalan_tertinggi_label,
    };
  });
  const urut = (a: any, b: any) => b.poin - a.poin || b.total_ayat - a.total_ayat;
  const topPoin = [...hasil].filter((h) => h.poin > 0).sort(urut).slice(0, 10);

  const perKelasMap: Record<string, any> = {};
  hasil.forEach((h) => { if (h.total_ayat > 0 && (!perKelasMap[h.kelas] || urut(h, perKelasMap[h.kelas]) < 0)) perKelasMap[h.kelas] = h; });
  const perKelas = Object.entries(perKelasMap).map(([kelas, h]) => ({ kelas, ...h })).sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }));

  return jsonOk({ top_poin: topPoin, per_kelas: perKelas, poin_per_halaman: pengaturan.poin_per_halaman });
});
