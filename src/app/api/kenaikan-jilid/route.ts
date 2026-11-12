import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import { fetchAll } from '@/lib/db-utils';
import { getPengaturan } from '@/lib/pengaturan';
import { hitungKesiapan } from '@/lib/ummi';
import { LEVEL_JILID_UMMI, LEVEL_UMMI_OPTIONS, levelBerikutnya } from '@/lib/helpers';

const TABEL_HILANG = 'Tabel kenaikan_jilid belum ada. Jalankan supabase/migration-kenaikan-jilid.sql di Supabase SQL Editor.';

async function cakupanSiswa(session: any) {
  const db = getSupabaseAdmin();
  let q = db.from('santri').select('id, nama, nis, kelas_id, level_ummi, user_id').order('nama');
  if (session.role === 'santri') {
    q = q.eq('user_id', session.user_id);
  } else if (session.role !== 'admin' && session.role !== 'penyimak') {
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
  const [siswaAll, pengaturan, kelasRes, usersRes, halaqahRes, binaanRows] = await Promise.all([
    cakupanSiswa(session), getPengaturan(),
    db.from('kelas').select('id, nama_kelas'), db.from('users').select('id, nama'),
    db.from('halaqah').select('id, nama, urutan').eq('aktif', true).order('urutan'),
    session.role === 'santri' ? Promise.resolve([] as any[]) : fetchAll<any>(() => db.from('penyimak_santri').select('id, penyimak_id, santri_id, halaqah_id').order('id')),
  ]);
  const halaqahList = (halaqahRes.data || []).map((h: any) => ({ id: h.id, nama: h.nama }));
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

  // guru pengampu per halaqah + penanda binaan guru yang sedang login
  const guruMap: Record<string, Record<string, string[]>> = {};
  const binaanSaya = new Set<number>();
  binaanRows.forEach((b: any) => {
    const sid = String(b.santri_id);
    ((guruMap[sid] = guruMap[sid] || {})[String(b.halaqah_id)] = guruMap[sid][String(b.halaqah_id)] || []).push(userNama[String(b.penyimak_id)] || '-');
    if (session.role === 'penyimak' && b.penyimak_id === session.user_id) binaanSaya.add(Number(b.santri_id));
  });

  const rows = siswa.map((s) => {
    const k = kesiapan[String(s.id)];
    const mine = riwayat.filter((r) => r.santri_id === s.id);
    const level = String(s.level_ummi);
    const gagal = mine.filter((r) => r.status === 'belum_lulus' && r.dari_jilid === level).length;
    let status: 'belum' | 'siap' | 'manual' | 'khatam' = 'belum';
    if (level === "Al-Qur'an") status = 'khatam';
    else if (!LEVEL_JILID_UMMI.includes(level)) status = 'manual';
    else if (k?.siap) status = 'siap';
    return {
      id: s.id, nama: s.nama, nis: s.nis, kelas_nama: kelasNama[String(s.kelas_id)] || '-', level,
      ke_jilid: levelBerikutnya(level), status, ujian_gagal: gagal,
      kelas_id: s.kelas_id, binaan_saya: binaanSaya.has(s.id),
      guru_halaqah: Object.fromEntries(Object.entries(guruMap[String(s.id)] || {}).map(([h, g]) => [h, g.join(' & ')])),
      ...(k || {}),
    };
  });

  const sekarang = Date.now();
  const riwayatOut = riwayat.map((r) => ({
    ...r,
    // admin selalu boleh; guru hanya untuk catatannya sendiri dalam 24 jam
    bisa_batal: ['lulus', 'belum_lulus'].includes(r.status) && (
      session.role === 'admin' ||
      (session.role === 'penyimak' && r.disahkan_oleh === session.user_id && r.disahkan_pada && sekarang - new Date(r.disahkan_pada).getTime() < 24 * 3600 * 1000)
    ),
    nama_siswa: siswaNama[String(r.santri_id)]?.nama || '-',
    kelas_nama: kelasNama[String(siswaNama[String(r.santri_id)]?.kelas_id)] || '-',
    dicatat_oleh_nama: userNama[String(r.disahkan_oleh || r.diajukan_oleh)] || '-',
  }));

  return jsonOk({
    pengaturan: { halaman_per_jilid: pengaturan.halaman_per_jilid, syarat_ujian: pengaturan.syarat_ujian },
    siswa: rows,
    halaqah: halaqahList,
    riwayat: riwayatOut,
    ringkas: { siap: rows.filter((r) => r.status === 'siap').length },
  });
});

// POST { action: 'catat' | 'batalkan_kenaikan', ... }
// Semua guru boleh menguji dan mencatat hasil ujian semua siswa yang siap; admin boleh untuk siapa pun (juga di luar syarat).
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

  if (p.action === 'catat') {
    if (p.hasil !== 'lulus' && p.hasil !== 'belum_lulus') throw new Error('Hasil ujian harus Lulus atau Belum lulus');
    let nilai: number | null = null;
    if (p.nilai_ujian !== '' && p.nilai_ujian !== null && p.nilai_ujian !== undefined) {
      nilai = Number(p.nilai_ujian);
      if (isNaN(nilai) || nilai < 0 || nilai > 100) throw new Error('Nilai ujian harus 0-100');
    }
    const s = await ambilSiswa(Number(p.santri_id));
    // cegah dobel-klik / dua guru mencatat bersamaan: level yang dilihat pengguna harus masih sama
    if (p.dari_jilid && p.dari_jilid !== s.level_ummi) throw new Error(`Level siswa sudah berubah menjadi ${s.level_ummi || '-'}. Muat ulang halaman.`);
    const ke = levelBerikutnya(s.level_ummi);
    if (!ke) throw new Error('Siswa sudah di level terakhir');
    if (!isAdmin) {
      if (!LEVEL_JILID_UMMI.includes(String(s.level_ummi))) throw new Error('Level siswa ini hanya bisa dicatat oleh admin');
      const k = (await hitungKesiapan([s], await getPengaturan()))[String(s.id)];
      if (!k?.siap) throw new Error('Siswa belum memenuhi syarat siap ujian kenaikan jilid');
    }
    // pengajuan lama (versi sebelumnya) yang masih menggantung ditutup
    await db.from('kenaikan_jilid').update({ status: 'dibatalkan' }).eq('santri_id', s.id).eq('status', 'diajukan');
    const { error } = await db.from('kenaikan_jilid').insert({
      santri_id: s.id, dari_jilid: s.level_ummi, ke_jilid: ke, status: p.hasil, diajukan_oleh: session.user_id,
      tanggal_ujian: p.tanggal_ujian || nowIso.slice(0, 10), penguji: String(p.penguji || '').trim() || null,
      nilai_ujian: nilai, catatan: String(p.catatan || '').trim() || null,
      disahkan_oleh: session.user_id, disahkan_pada: nowIso,
    });
    if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? TABEL_HILANG : error.message);
    if (p.hasil === 'lulus') await db.from('santri').update({ level_ummi: ke }).eq('id', s.id);
    await logAudit(session, { aksi: 'kenaikan.catat', santri_id: s.id, santri_nama: s.nama,
      ringkasan: `${s.level_ummi} → ${ke}: ${p.hasil === 'lulus' ? 'LULUS' : 'Belum lulus'}${nilai !== null ? `, nilai ujian ${nilai}` : ''}${p.penguji ? `, penguji ${p.penguji}` : ''}`,
      sesudah: { dari: s.level_ummi, ke, hasil: p.hasil, nilai_ujian: nilai, penguji: p.penguji || null, catatan: p.catatan || null } });
    return jsonOk({ level_baru: p.hasil === 'lulus' ? ke : null });
  }

  if (p.action === 'batalkan_kenaikan') {
    const { data: r } = await db.from('kenaikan_jilid').select('*').eq('id', p.id).maybeSingle();
    if (!r || !['lulus', 'belum_lulus'].includes(r.status)) throw new Error('Catatan tidak ditemukan atau sudah dibatalkan');
    if (!isAdmin) {
      if (r.disahkan_oleh !== session.user_id) throw new Error('Guru hanya bisa membatalkan catatannya sendiri');
      if (!r.disahkan_pada || Date.now() - new Date(r.disahkan_pada).getTime() >= 24 * 3600 * 1000) throw new Error('Batas 24 jam untuk membatalkan sudah lewat. Hubungi admin.');
    }
    const s = await ambilSiswa(r.santri_id);
    const { error } = await db.from('kenaikan_jilid').update({ status: 'dibatalkan' }).eq('id', r.id);
    if (error) throw new Error(error.message);
    let dikembalikan = false;
    if (r.status === 'lulus' && s.level_ummi === r.ke_jilid) {
      await db.from('santri').update({ level_ummi: r.dari_jilid }).eq('id', r.santri_id);
      dikembalikan = true;
    }
    await logAudit(session, { aksi: 'kenaikan.batal', objek_id: r.id, santri_id: r.santri_id, santri_nama: s.nama,
      ringkasan: `Pembatalan catatan ${r.dari_jilid} → ${r.ke_jilid} (${r.status})${dikembalikan ? `; level dikembalikan ke ${r.dari_jilid}` : ''}`,
      sebelum: { status: r.status, dari: r.dari_jilid, ke: r.ke_jilid, nilai_ujian: r.nilai_ujian }, sesudah: { status: 'dibatalkan', level_dikembalikan: dikembalikan } });
    return jsonOk({ level_dikembalikan: dikembalikan });
  }

  throw new Error('Aksi tidak dikenal');
});
