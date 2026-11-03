import { NextRequest } from 'next/server';
import { requireAuth, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

function slugUsername(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// POST /api/santri/buat-akun { password?, santri_ids?: number[] }  (admin)
// Membuat akun role Siswa untuk siswa yang BELUM punya akun, lalu menghubungkannya.
// Username = NIS (jika ada), kalau tidak ada = nama tanpa spasi; otomatis diberi angka bila bentrok.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa membuat akun siswa');
  const p = await req.json();
  const password = String(p.password || '123456');
  if (password.length < 6) throw new Error('Password awal minimal 6 karakter');
  const onlyIds: string[] | null = Array.isArray(p.santri_ids) && p.santri_ids.length ? p.santri_ids.map(String) : null;

  const db = getSupabaseAdmin();
  const [santriRes, usersRes, kelasRes] = await Promise.all([
    db.from('santri').select('id, nama, nis, kelas_id, user_id').order('nama'),
    db.from('users').select('username'),
    db.from('kelas').select('id, nama_kelas'),
  ]);
  const targets = (santriRes.data || []).filter((s) => !s.user_id && (!onlyIds || onlyIds.includes(String(s.id))));
  if (!targets.length) return jsonOk({ created: [], message: 'Semua siswa sudah punya akun' });

  const used = new Set((usersRes.data || []).map((u) => String(u.username).toLowerCase()));
  const kelasMap: Record<string, string> = {};
  (kelasRes.data || []).forEach((k) => { kelasMap[String(k.id)] = k.nama_kelas; });
  const hash = await hashPassword(password); // satu hash dipakai bersama (password awal sama)

  const plan = targets.map((s) => {
    let base = slugUsername(s.nis) || slugUsername(s.nama) || 'siswa';
    let u = base, n = 1;
    while (used.has(u)) { n++; u = base + n; }
    used.add(u);
    return { santri: s, username: u };
  });

  const { data: inserted, error } = await db
    .from('users')
    .insert(plan.map((x) => ({
      nama: x.santri.nama, username: x.username, password_hash: hash,
      role: 'santri', kelas_id: x.santri.kelas_id || null, status: 'aktif',
    })))
    .select('id, username');
  if (error) throw new Error(error.message);

  const idByUsername: Record<string, number> = {};
  (inserted || []).forEach((u) => { idByUsername[String(u.username)] = u.id; });

  // Hubungkan akun ke siswa (paralel per 20 baris)
  for (let i = 0; i < plan.length; i += 20) {
    await Promise.all(plan.slice(i, i + 20).map((x) =>
      db.from('santri').update({ user_id: idByUsername[x.username] }).eq('id', x.santri.id)
    ));
  }

  return jsonOk({
    created: plan.map((x) => ({
      santri_id: x.santri.id,
      nama: x.santri.nama,
      kelas_nama: x.santri.kelas_id ? kelasMap[String(x.santri.kelas_id)] || '' : '',
      username: x.username,
      password,
    })),
  });
});
