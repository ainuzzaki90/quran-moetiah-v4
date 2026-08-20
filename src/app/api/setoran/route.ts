import { NextRequest } from 'next/server';
import { requireAuth, SessionUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak, getKelasIdSantri } from '@/lib/relations';
import { calcPredikat } from '@/lib/helpers';

// GET /api/setoran?santri_id=
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  let query = db.from('setoran').select('*').order('tanggal', { ascending: false });

  if (session.role === 'santri') {
    const { data: me } = await db.from('santri').select('id').eq('user_id', session.user_id).maybeSingle();
    query = query.eq('santri_id', me ? me.id : -1);
  }
  const santriIdParam = req.nextUrl.searchParams.get('santri_id');
  if (santriIdParam) query = query.eq('santri_id', santriIdParam);

  let { data, error } = await query;
  if (error) throw new Error(error.message);
  let list = data || [];

  if (session.role === 'penyimak') {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    list = list.filter((s) => binaanIds.includes(String(s.santri_id)));
  }

  return jsonOk({ data: list });
});

function buildSetoranRow(session: SessionUser, tanggal: string, santriId: number, kelasId: number | null, item: any) {
  const predikat = item.predikat && item.predikat !== '' ? item.predikat : calcPredikat(item.nilai);
  return {
    tanggal,
    santri_id: santriId,
    kelas_id: kelasId,
    penyimak_id: session.user_id,
    jenis: item.jenis,
    surah: item.surah || null,
    ayat_mulai: item.ayat_mulai || null,
    surah_selesai: item.surah_selesai || item.surah || null,
    ayat_selesai: item.ayat_selesai || null,
    halaman_mulai: item.halaman_mulai || null,
    halaman_selesai: item.halaman_selesai || null,
    nilai: item.nilai ?? null,
    predikat: predikat || null,
    nilai_tajwid: item.nilai_tajwid ?? null,
    nilai_fashohah: item.nilai_fashohah ?? null,
    nilai_kelancaran: item.nilai_kelancaran ?? null,
    catatan: item.catatan || null,
  };
}

// POST /api/setoran  { santri_id, tanggal, kelas_id?, jenis, ... }  -> satu baris
// atau { santri_id, tanggal, items: [...] }                        -> batch (form dinamis)
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');

  const payload = await req.json();
  if (!payload.santri_id) throw new Error('santri_id wajib diisi');
  if (!payload.tanggal) throw new Error('Tanggal wajib diisi');

  const db = getSupabaseAdmin();
  const kelasId = payload.kelas_id || (await getKelasIdSantri(payload.santri_id));

  if (Array.isArray(payload.items)) {
    const rows = payload.items.map((it: any) =>
      buildSetoranRow(session, payload.tanggal, payload.santri_id, kelasId, {
        ...it,
        catatan: it.catatan !== undefined && it.catatan !== '' ? it.catatan : (payload.catatan || ''),
      })
    );
    const { data, error } = await db.from('setoran').insert(rows).select();
    if (error) throw new Error(error.message);
    return jsonOk({ count: data.length });
  }

  const row = buildSetoranRow(session, payload.tanggal, payload.santri_id, kelasId, payload);
  const { data, error } = await db.from('setoran').insert(row).select().single();
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});
