import { NextRequest } from 'next/server';
import { requireAuth, SessionUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak, getKelasIdSantri } from '@/lib/relations';
import { calcPredikat, hitungNilaiAspek, JENIS_PAKAI_ASPEK, Bobot } from '@/lib/helpers';
import { getPengaturan } from '@/lib/pengaturan';
import { parseHalaqahParam, getDefaultHalaqahId } from '@/lib/halaqah';
import { enrichSetoranRows } from '@/lib/enrich';

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
  const hq = parseHalaqahParam(req.nextUrl.searchParams.get('halaqah_id'));
  if (hq) query = query.eq('halaqah_id', hq);

  let { data, error } = await query;
  if (error) throw new Error(error.message);
  let list = data || [];

  if (session.role === 'penyimak') {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    list = list.filter((s) => binaanIds.includes(String(s.santri_id)));
  }

  return jsonOk({ data: await enrichSetoranRows(list) });
});

function buildSetoranRow(session: SessionUser, tanggal: string, santriId: number, kelasId: number | null, halaqahId: any, item: any, bobot: Bobot) {
  // Hafalan Baru / Murojaah: nilai dihitung server dari 4 aspek (bobot dari Pengaturan)
  let aspek: Record<string, any> = {};
  if (JENIS_PAKAI_ASPEK.includes(item.jenis) && item.skor) {
    const n = hitungNilaiAspek(item.skor, bobot);
    if (n === null) throw new Error(`Nilai 4 aspek untuk "${item.jenis}" wajib diisi semua`);
    aspek = {
      nilai: n,
      nilai_makharij: Number(item.skor.makharij), nilai_tajwid: Number(item.skor.tajwid),
      nilai_kelancaran: Number(item.skor.kelancaran), nilai_ketepatan: Number(item.skor.ketepatan),
    };
    item = { ...item, nilai: n, predikat: '' };
  }
  const predikat = item.predikat && item.predikat !== '' ? item.predikat : calcPredikat(item.nilai);
  return {
    tanggal,
    santri_id: santriId,
    kelas_id: kelasId,
    penyimak_id: session.user_id,
    halaqah_id: halaqahId,
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
    ...aspek,
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
  const halaqahId = payload.halaqah_id || (await getDefaultHalaqahId());
  if (!halaqahId) throw new Error('Halaqah belum dipilih');
  const { bobot } = await getPengaturan();

  if (Array.isArray(payload.items)) {
    const rows = payload.items.map((it: any) =>
      buildSetoranRow(session, payload.tanggal, payload.santri_id, kelasId, halaqahId, {
        ...it,
        catatan: it.catatan !== undefined && it.catatan !== '' ? it.catatan : (payload.catatan || ''),
      }, bobot)
    );
    const { data, error } = await db.from('setoran').insert(rows).select();
    if (error) throw new Error(error.message);
    return jsonOk({ count: data.length });
  }

  const row = buildSetoranRow(session, payload.tanggal, payload.santri_id, kelasId, halaqahId, payload, bobot);
  const { data, error } = await db.from('setoran').insert(row).select().single();
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});
