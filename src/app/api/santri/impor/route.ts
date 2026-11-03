import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

const norm = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// POST /api/santri/impor { rows: [{ nama, nis?, kelas_id?, jenis_kelamin?, level_ummi? }], buat_baru?: boolean }  (admin)
// MODE PERBARUI: mencocokkan baris dengan siswa yang SUDAH ADA lalu hanya memperbarui kolom yang terisi.
// Setoran, presensi, hafalan, dan binaan tidak tersentuh (semuanya terhubung lewat ID siswa).
// Pencocokan: (1) NIS sama; (2) nama sama (+ kelas jika diisi) bila hanya ada 1 kecocokan.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa memperbarui data siswa lewat file');
  const p = await req.json();
  const rows: any[] = Array.isArray(p.rows) ? p.rows : [];
  if (!rows.length) throw new Error('File tidak berisi data');

  const db = getSupabaseAdmin();
  const { data: all, error } = await db.from('santri').select('id, nama, nis, kelas_id, jenis_kelamin, level_ummi');
  if (error) throw new Error(error.message);
  const santri = all || [];

  const byNis: Record<string, any[]> = {};
  const byNama: Record<string, any[]> = {};
  santri.forEach((s) => {
    if (s.nis) (byNis[norm(s.nis)] = byNis[norm(s.nis)] || []).push(s);
    (byNama[norm(s.nama)] = byNama[norm(s.nama)] || []).push(s);
  });

  const updated: string[] = [], unchanged: string[] = [], tidakDitemukan: string[] = [], ganda: string[] = [];
  const toCreate: any[] = [];
  const dipakai = new Set<string>(); // satu siswa hanya diperbarui sekali

  for (const r of rows) {
    const nama = String(r.nama || '').trim();
    if (!nama) continue;
    let match: any = null;

    if (r.nis && byNis[norm(r.nis)]?.length === 1) match = byNis[norm(r.nis)][0];
    if (!match) {
      let cand = byNama[norm(nama)] || [];
      if (cand.length > 1 && r.kelas_id) cand = cand.filter((s) => String(s.kelas_id) === String(r.kelas_id));
      if (cand.length === 1) match = cand[0];
      else if (cand.length > 1) { ganda.push(`${nama} (ada ${cand.length} siswa bernama sama; isi NIS agar bisa dicocokkan)`); continue; }
    }

    if (!match) {
      if (p.buat_baru) toCreate.push({
        nama, nis: r.nis || null, kelas_id: r.kelas_id || null,
        jenis_kelamin: r.jenis_kelamin || null, level_ummi: r.level_ummi || null,
      });
      else tidakDitemukan.push(nama);
      continue;
    }
    if (dipakai.has(String(match.id))) { ganda.push(`${nama} (muncul lebih dari sekali di file)`); continue; }
    dipakai.add(String(match.id));

    // Hanya kolom yang terisi yang diperbarui. Nama hanya diubah bila pencocokan lewat NIS.
    const upd: Record<string, any> = {};
    if (r.nis && String(r.nis) !== String(match.nis || '')) upd.nis = String(r.nis);
    if (norm(match.nama) !== norm(nama) && r.nis && byNis[norm(r.nis)]?.[0]?.id === match.id) upd.nama = nama;
    if (r.kelas_id && String(r.kelas_id) !== String(match.kelas_id)) upd.kelas_id = r.kelas_id;
    if (r.jenis_kelamin && r.jenis_kelamin !== match.jenis_kelamin) upd.jenis_kelamin = r.jenis_kelamin;
    if (r.level_ummi && r.level_ummi !== match.level_ummi) upd.level_ummi = r.level_ummi;

    if (!Object.keys(upd).length) { unchanged.push(nama); continue; }
    const { error: e2 } = await db.from('santri').update(upd).eq('id', match.id);
    if (e2) throw new Error(`${nama}: ${e2.message}`);
    updated.push(nama);
  }

  let dibuat = 0;
  if (toCreate.length) {
    const { data: ins, error: e3 } = await db.from('santri').insert(toCreate).select('id');
    if (e3) throw new Error(e3.message);
    dibuat = (ins || []).length;
  }

  return jsonOk({ diperbarui: updated.length, tidak_berubah: unchanged.length, dibuat, tidak_ditemukan: tidakDitemukan, ganda });
});
