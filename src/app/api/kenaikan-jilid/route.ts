import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { getPengaturan } from '@/lib/pengaturan';
import { hitungKesiapan } from '@/lib/ummi';
import { LEVEL_JILID_UMMI, LEVEL_UMMI_OPTIONS, levelBerikutnya } from '@/lib/helpers';

const TABEL_HILANG = 'Tabel kenaikan_jilid belum ada. Jalankan supabase/migration-kenaikan-jilid.sql di Supabase SQL Editor.';

async function cakupanSiswa(session: any) {
  const db = getSupabaseAdmin();
  let q = db.from('santri').select('id, nama, nis, kelas_id, level_ummi, user_id').order('nama');
  if (session.role === 'penyimak') {
    const ids = (await getSantriIdsForPenyimak(session.user_id)).map(Number);
    if (!ids.length) return [];
    q = q.in('id', ids);
  } else if (session.role === 'santri') {
    q = q.eq('user_id', session.user_id);
  } else if (session.role !== 'admin') {
    throw new Error('Tidak diizinkan');
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

// GET -> daftar siswa + status kenaikan jilid + riwayat
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const [siswaAll, pengaturan, kelasRes, usersRes] = await Promise.all([
    cakupanSiswa(session), getPengaturan(),
    db.from('kelas').select('id, nama_kelas'), db.from('users').select('id, nama'),
  ]);
  const siswa = siswaAll.filter((s) => LEVEL_UMMI_OPTIONS.includes(String(s.level_ummi)));
  const ids = siswa.map((s) => s.id);

  let riwayat: any[] = [];
  if (ids.length) {
    const { data, error } = await db.from('kenaikan_jilid').select('*').in('santri_id', ids).order('id', { ascending: false }).limit(500);
    if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? TABEL_HILANG : error.message);
    riwayat = data || [];
  }
  const kesiapan = await hitungKesiapan(siswa.filter((s) => LEVEL_JILID_UMMI.includes(String(s.level_ummi))), pengaturan);

  const kelasNama: Record<string, string> = {}; (kelasRes.data || []).forEach((k) => { kelasNama[String(k.id)] = k.nama_kelas; });
  const userNama: Record<string, string> = {}; (usersRes.data || []).forEach((u) => { userNama[String(u.id)] = u.nama; });
  const siswaNama: Record<string, any> = {}; siswa.forEach((s) => { siswaNama[String(s.id)] = s; });

  const rows = siswa.map((s) => {
    const k = kesiapan[String(s.id)];
    const mine = riwayat.filter((r) => r.santri_id === s.id);
    const pending = mine.find((r) => r.status === 'diajukan');
    const level = String(s.level_ummi);
    const gagal = mine.filter((r) => r.status === 'belum_lulus' && r.dari_jilid === level).length;
    let status: 'belum' | 'siap' | 'diajukan' | 'manual' | 'khatam' = 'belum';
    if (level === "Al-Qur'an") status = 'khatam';
    else if (!LEVEL_JILID_UMMI.includes(level)) status = 'manual';
    else if (pending) status = 'diajukan';
    else if (k?.siap) status = 'siap';
    return {
      id: s.id, nama: s.nama, nis: s.nis, kelas_nama: kelasNama[String(s.kelas_id)] || '-', level,
      ke_jilid: levelBerikutnya(level), status, pengajuan_id: pending?.id || null, ujian_gagal: gagal,
      ...(k || {}),
    };
  });

  const riwayatOut = riwayat.map((r) => ({
    ...r,
    nama_siswa: siswaNama[String(r.santri_id)]?.nama || '-',
    kelas_nama: kelasNama[String(siswaNama[String(r.santri_id)]?.kelas_id)] || '-',
    diajukan_oleh_nama: userNama[String(r.diajukan_oleh)] || '-',
    disahkan_oleh_nama: userNama[String(r.disahkan_oleh)] || '',
  }));

  return jsonOk({
    pengaturan: { halaman_per_jilid: pengaturan.halaman_per_jilid, syarat_ujian: pengaturan.syarat_ujian },
    siswa: rows,
    riwayat: riwayatOut,
    ringkas: { siap: rows.filter((r) => r.status === 'siap').length, diajukan: rows.filter((r) => r.status === 'diajukan').length },
  });
});

// POST { action: 'ajukan'|'hasil'|'catat'|'batal'|'batalkan_kenaikan', ... }
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin' && session.role !== 'penyimak') throw new Error('Tidak diizinkan');
  const isAdmin = session.role === 'admin';
  const p = await req.json();
  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  async function ambilSiswa(id: number) {
    const { data } = await db.from('santri').select('id, nama, level_ummi').eq('id', id).maybeSingle();
    if (!data) throw new Error('Siswa tidak ditemukan');
    return data;
  }
  const cekHasil = (h: any) => { if (h !== 'lulus' && h !== 'belum_lulus') throw new Error('Hasil ujian harus Lulus atau Belum lulus'); };
  const cekNilai = (v: any) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v); if (isNaN(n) || n < 0 || n > 100) throw new Error('Nilai ujian harus 0-100'); return n;
  };

  if (p.action === 'ajukan') {
    const s = await ambilSiswa(Number(p.santri_id));
    if (!isAdmin) {
      const ids = await getSantriIdsForPenyimak(session.user_id);
      if (!ids.includes(String(s.id))) throw new Error('Siswa ini bukan binaan Anda');
    }
    const ke = levelBerikutnya(s.level_ummi);
    if (!ke || !LEVEL_JILID_UMMI.includes(String(s.level_ummi))) throw new Error('Level siswa ini tidak memakai pengajuan otomatis. Admin dapat mencatat ujian langsung.');
    if (!isAdmin) {
      const k = (await hitungKesiapan([s], await getPengaturan()))[String(s.id)];
      if (!k?.siap) throw new Error('Siswa belum memenuhi syarat siap ujian kenaikan jilid');
    }
    const { error } = await db.from('kenaikan_jilid').insert({ santri_id: s.id, dari_jilid: s.level_ummi, ke_jilid: ke, status: 'diajukan', diajukan_oleh: session.user_id });
    if (error) {
      if (error.code === '23505') throw new Error('Siswa ini sudah memiliki pengajuan yang menunggu ujian');
      throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? TABEL_HILANG : error.message);
    }
    return jsonOk();
  }

  if (p.action === 'batal') {
    const { data: r } = await db.from('kenaikan_jilid').select('*').eq('id', p.id).maybeSingle();
    if (!r || r.status !== 'diajukan') throw new Error('Pengajuan tidak ditemukan atau sudah diproses');
    if (!isAdmin && r.diajukan_oleh !== session.user_id) throw new Error('Hanya pengaju atau admin yang bisa membatalkan');
    const { error } = await db.from('kenaikan_jilid').update({ status: 'dibatalkan' }).eq('id', r.id);
    if (error) throw new Error(error.message);
    return jsonOk();
  }

  // ---- selanjutnya khusus admin ----
  if (!isAdmin) throw new Error('Hanya admin yang bisa mengesahkan hasil ujian kenaikan jilid');

  async function terapkan(r: { id?: number; santri_id: number; dari_jilid: string; ke_jilid: string }, hasil: string) {
    if (hasil === 'lulus') {
      const s = await ambilSiswa(r.santri_id);
      if (s.level_ummi !== r.dari_jilid) throw new Error(`Level siswa sudah berubah menjadi ${s.level_ummi || '-'}. Batalkan pengajuan ini lalu buat ulang.`);
    }
  }
  const detail = () => ({
    tanggal_ujian: p.tanggal_ujian || nowIso.slice(0, 10), penguji: String(p.penguji || '').trim() || null,
    nilai_ujian: cekNilai(p.nilai_ujian), catatan: String(p.catatan || '').trim() || null,
    disahkan_oleh: session.user_id, disahkan_pada: nowIso,
  });

  if (p.action === 'hasil') {
    cekHasil(p.hasil);
    const { data: r } = await db.from('kenaikan_jilid').select('*').eq('id', p.id).maybeSingle();
    if (!r || r.status !== 'diajukan') throw new Error('Pengajuan tidak ditemukan atau sudah diproses');
    await terapkan(r, p.hasil);
    const { error } = await db.from('kenaikan_jilid').update({ status: p.hasil, ...detail() }).eq('id', r.id);
    if (error) throw new Error(error.message);
    if (p.hasil === 'lulus') await db.from('santri').update({ level_ummi: r.ke_jilid }).eq('id', r.santri_id);
    return jsonOk({ level_baru: p.hasil === 'lulus' ? r.ke_jilid : null });
  }

  if (p.action === 'catat') {
    cekHasil(p.hasil);
    const s = await ambilSiswa(Number(p.santri_id));
    const ke = levelBerikutnya(s.level_ummi);
    if (!ke) throw new Error('Siswa sudah di level terakhir');
    // batalkan pengajuan yang masih menunggu agar tidak dobel
    await db.from('kenaikan_jilid').update({ status: 'dibatalkan' }).eq('santri_id', s.id).eq('status', 'diajukan');
    const { error } = await db.from('kenaikan_jilid').insert({
      santri_id: s.id, dari_jilid: s.level_ummi, ke_jilid: ke, status: p.hasil, diajukan_oleh: session.user_id, ...detail(),
    });
    if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? TABEL_HILANG : error.message);
    if (p.hasil === 'lulus') await db.from('santri').update({ level_ummi: ke }).eq('id', s.id);
    return jsonOk({ level_baru: p.hasil === 'lulus' ? ke : null });
  }

  if (p.action === 'batalkan_kenaikan') {
    const { data: r } = await db.from('kenaikan_jilid').select('*').eq('id', p.id).maybeSingle();
    if (!r || r.status !== 'lulus') throw new Error('Hanya kenaikan yang berstatus Lulus yang bisa dibatalkan');
    const s = await ambilSiswa(r.santri_id);
    const { error } = await db.from('kenaikan_jilid').update({ status: 'dibatalkan' }).eq('id', r.id);
    if (error) throw new Error(error.message);
    if (s.level_ummi === r.ke_jilid) await db.from('santri').update({ level_ummi: r.dari_jilid }).eq('id', r.santri_id);
    return jsonOk({ level_dikembalikan: s.level_ummi === r.ke_jilid });
  }

  throw new Error('Aksi tidak dikenal');
});
