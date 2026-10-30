import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getPengaturan } from '@/lib/pengaturan';

// GET -> semua role boleh baca (form setoran butuh bobot untuk hitung nilai langsung)
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(getToken(req));
  return jsonOk(await getPengaturan());
});

// PUT { bobot: {makharij,tajwid,kelancaran,ketepatan}, poin_per_halaman }  (admin)
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa mengubah pengaturan');
  const p = await req.json();
  const db = getSupabaseAdmin();

  if (p.bobot) {
    const b = {
      makharij: Number(p.bobot.makharij), tajwid: Number(p.bobot.tajwid),
      kelancaran: Number(p.bobot.kelancaran), ketepatan: Number(p.bobot.ketepatan),
    };
    const vals = Object.values(b);
    if (vals.some((v) => isNaN(v) || v < 0)) throw new Error('Bobot harus berupa angka 0 atau lebih');
    const total = vals.reduce((a, c) => a + c, 0);
    if (Math.round(total * 100) / 100 !== 100) throw new Error(`Total bobot harus 100% (saat ini ${total}%)`);
    const { error } = await db.from('pengaturan').upsert({ kunci: 'bobot_penilaian', nilai: b, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }
  if (p.poin_per_halaman !== undefined) {
    const v = Number(p.poin_per_halaman);
    if (isNaN(v) || v < 0) throw new Error('Poin per halaman harus angka 0 atau lebih');
    const { error } = await db.from('pengaturan').upsert({ kunci: 'poin_per_halaman', nilai: v, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }
  return jsonOk();
});
