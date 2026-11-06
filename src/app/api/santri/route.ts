import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { parseHalaqahParam, getDefaultHalaqahId } from '@/lib/halaqah';
import { fetchAll, SETORAN_HAFALAN_COLS } from '@/lib/db-utils';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { computeCapaianTerakhir } from '@/lib/helpers';
import { getKenaikanTerakhir, filterSetoranSejakNaik } from '@/lib/ummi';

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
    const binaanIds = await getSantriIdsForPenyimak(session.user_id, parseHalaqahParam(params.get('halaqah_id')));
    list = list.filter((s) => binaanIds.includes(String(s.id)));
  }

  // with_posisi=true -> sertakan halaman/surah terakhir tiap siswa + guru pengampu (binaan)
  if (params.get('with_posisi')) {
    const hq = parseHalaqahParam(params.get('halaqah_id'));
    // Posisi hafalan/halaman terakhir dibagi lintas halaqah (Pagi & Malam): semua setoran dihitung.
    // Hanya guru pengampu yang mengikuti halaqah terpilih. Query paralel, kolom dipersempit.
    const [setoranAll, binaanRes, usersRes, naikMap] = await Promise.all([
      fetchAll(() => db.from('setoran').select(SETORAN_HAFALAN_COLS).order('id')),
      db.from('penyimak_santri').select('santri_id, penyimak_id, halaqah_id'),
      db.from('users').select('id, nama'),
      getKenaikanTerakhir(),
    ]);
    const binaanAll = (binaanRes.data || []).filter((b) => !hq || String(b.halaqah_id) === hq);
    const usersAll = usersRes.data;
    const bySantri: Record<string, any[]> = {};
    setoranAll.forEach((r: any) => { (bySantri[String(r.santri_id)] = bySantri[String(r.santri_id)] || []).push(r); });
    const guruMap: Record<string, string> = {};
    (binaanAll || []).forEach((b) => {
      const u = (usersAll || []).find((x) => String(x.id) === String(b.penyimak_id));
      if (u) guruMap[String(b.santri_id)] = u.nama;
    });
    // Guru pengampu per halaqah (Pagi / Malam): { santriId: { halaqahId: 'Nama & Nama' } }
    const namaUser: Record<string, string> = {};
    (usersAll || []).forEach((u) => { namaUser[String(u.id)] = u.nama; });
    const guruPerHalaqah: Record<string, Record<string, string[]>> = {};
    (binaanRes.data || []).forEach((b) => {
      const nm = namaUser[String(b.penyimak_id)];
      if (!nm) return;
      const sm = (guruPerHalaqah[String(b.santri_id)] = guruPerHalaqah[String(b.santri_id)] || {});
      (sm[String(b.halaqah_id)] = sm[String(b.halaqah_id)] || []).push(nm);
    });
    list = list.map((s) => {
      const rows = bySantri[String(s.id)] || [];
      const capaian = computeCapaianTerakhir(filterSetoranSejakNaik(rows as any[], naikMap[String(s.id)]) as any);
      return {
        ...s,
        halaman_terakhir: capaian.halaman ? capaian.halaman.label : '-',
        surah_terakhir: capaian.surah ? capaian.surah.label : '-',
        guru_pengampu: guruMap[String(s.id)] || '-',
        jumlah_setoran: rows.length,
        guru_halaqah: Object.fromEntries(Object.entries(guruPerHalaqah[String(s.id)] || {}).map(([h, arr]) => [h, arr.join(' & ')])),
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
      user_id: session.role === 'admin' ? (payload.user_id || null) : null,
      level_ummi: payload.level_ummi || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (session.role === 'penyimak') {
    // Siswa baru dari penyimak otomatis jadi binaan di SEMUA halaqah aktif (semua siswa ikut keduanya)
    const { data: hs } = await db.from('halaqah').select('id').eq('aktif', true);
    const defId = await getDefaultHalaqahId();
    const ids = (hs && hs.length ? hs.map((h) => h.id) : [defId]).filter(Boolean);
    if (ids.length) {
      await db.from('penyimak_santri').insert(ids.map((hid) => ({ penyimak_id: session.user_id, santri_id: row.id, halaqah_id: hid })));
    }
  }

  return jsonOk({ data: row });
});
