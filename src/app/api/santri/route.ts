import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { computeCapaianTerakhir } from '@/lib/helpers';

// GET /api/santri?kelas_id=&binaan_only=1&with_posisi=1
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;

  let query = db.from('santri').select('*').order('nama');

  if (session.role === 'santri') {
    query = query.eq('user_id', session.user_id);
  }
  if (params.get('kelas_id')) query = query.eq('kelas_id', params.get('kelas_id'));

  let { data, error } = await query;
  if (error) throw new Error(error.message);
  let list = data || [];

  // binaan_only=true -> penyimak hanya lihat siswa binaannya (dropdown setoran)
  if (session.role === 'penyimak' && params.get('binaan_only')) {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    list = list.filter((s) => binaanIds.includes(String(s.id)));
  }

  // with_posisi=true -> sertakan halaman/surah terakhir tiap siswa
  if (params.get('with_posisi')) {
    const { data: setoranAll } = await db.from('setoran').select('*');
    list = list.map((s) => {
      const rows = (setoranAll || []).filter((r) => String(r.santri_id) === String(s.id));
      const capaian = computeCapaianTerakhir(rows as any);
      return {
        ...s,
        halaman_terakhir: capaian.halaman ? capaian.halaman.label : '-',
        surah_terakhir: capaian.surah ? capaian.surah.label : '-',
      };
    });
  }

  return jsonOk({ data: list });
});

// POST /api/santri  { nama, nis, kelas_id, jenis_kelamin, tanggal_lahir, user_id, level_ummi }
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');

  const payload = await req.json();
  if (!payload.nama || !String(payload.nama).trim()) throw new Error('Nama santri wajib diisi');

  const db = getSupabaseAdmin();
  const { data: row, error } = await db
    .from('santri')
    .insert({
      nama: String(payload.nama).trim(),
      nis: payload.nis || null,
      kelas_id: payload.kelas_id || null,
      jenis_kelamin: payload.jenis_kelamin || null,
      tanggal_lahir: payload.tanggal_lahir || null,
      user_id: payload.user_id || null,
      level_ummi: payload.level_ummi || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (session.role === 'penyimak') {
    await db.from('penyimak_santri').insert({ penyimak_id: session.user_id, santri_id: row.id });
  }

  return jsonOk({ data: row });
});
