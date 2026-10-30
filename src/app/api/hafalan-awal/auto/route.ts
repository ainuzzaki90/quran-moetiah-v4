import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { computeHafalan } from '@/lib/hafalan';
import { SURAH_PAGES } from '@/lib/surah-pages';

const NAME_TO_NO: Record<string, number> = {};
SURAH_PAGES.forEach((s) => { NAME_TO_NO[s[1]] = s[0]; });

// GET -> usulan hafalan awal otomatis untuk semua siswa (admin).
// Aturan: surat terjauh yang pernah disetor sebagai Hafalan Baru (nomor surat terkecil)
// dianggap batas hafalan; semua surat dari An-Nas sampai batas dianggap hafal.
// Jika surat batas itu belum tercapai ayat terakhirnya, batas mundur ke surat sebelumnya.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin');
  const db = getSupabaseAdmin();

  const { data: santriAll } = await db.from('santri').select('id, nama, kelas_id, level_ummi').order('nama');
  const { data: kelasAll } = await db.from('kelas').select('id, nama_kelas');
  const { data: setoranAll } = await db.from('setoran').select('santri_id, jenis, surah, ayat_mulai, surah_selesai, ayat_selesai, nilai').eq('jenis', 'Hafalan Baru');
  const { data: awalAll } = await db.from('hafalan_awal').select('santri_id, surah_no');

  const awalMap: Record<string, number[]> = {};
  (awalAll || []).forEach((a) => { (awalMap[String(a.santri_id)] = awalMap[String(a.santri_id)] || []).push(a.surah_no); });
  const kelasMap: Record<string, string> = {};
  (kelasAll || []).forEach((k) => { kelasMap[String(k.id)] = k.nama_kelas; });

  const out: any[] = [];
  (santriAll || []).forEach((s) => {
    const rows = (setoranAll || []).filter((r) => String(r.santri_id) === String(s.id));
    if (!rows.length) return;
    let minNo = 115;
    rows.forEach((r) => {
      [r.surah, r.surah_selesai].forEach((nm) => {
        const no = NAME_TO_NO[String(nm || '')];
        if (no && no < minNo) minNo = no;
      });
    });
    if (minNo > 114) return;

    const awal = awalMap[String(s.id)] || [];
    // Apakah surat batas sudah tercapai penuh lewat setoran (nilai >= minimal)?
    const sekarang = computeHafalan(rows as any, awal);
    const penuh = sekarang.hafal_nos.includes(minNo);
    const batas = penuh ? minNo : Math.min(114, minNo + 1);
    const hasil = computeHafalan([], Array.from(new Set([...awal, ...Array.from({ length: 114 - batas + 1 }, (_, i) => 114 - i)])));

    out.push({
      santri_id: s.id,
      nama: s.nama,
      kelas_nama: s.kelas_id ? kelasMap[String(s.kelas_id)] || '-' : '-',
      level_ummi: s.level_ummi || '',
      surat_terjauh: SURAH_PAGES[minNo - 1][1],
      surat_terjauh_penuh: penuh,
      sekarang_berurutan: sekarang.berurutan,
      sampai_no: batas,
      sampai_nama: SURAH_PAGES[batas - 1][1],
      hasil_berurutan: hasil.berurutan,
      berubah: hasil.berurutan > sekarang.berurutan,
    });
  });
  out.sort((a, b) => b.hasil_berurutan - a.hasil_berurutan);
  return jsonOk({ data: out });
});

// POST { items: [{ santri_id, sampai_no }] } -> tambahkan surat 114..sampai_no ke hafalan awal (tidak menghapus yang sudah ada)
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin');
  const p = await req.json();
  const items: { santri_id: number; sampai_no: number }[] = p.items || [];
  if (!items.length) throw new Error('Tidak ada data untuk disimpan');
  const rows: any[] = [];
  items.forEach((it) => {
    const to = Number(it.sampai_no);
    if (!it.santri_id || !(to >= 1 && to <= 114)) return;
    for (let n = 114; n >= to; n--) rows.push({ santri_id: it.santri_id, surah_no: n });
  });
  const db = getSupabaseAdmin();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('hafalan_awal').upsert(rows.slice(i, i + 500), { onConflict: 'santri_id,surah_no', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return jsonOk({ siswa: items.length });
});
