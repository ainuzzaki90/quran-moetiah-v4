import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

// GET /api/halaqah  -> semua role boleh baca (dipakai sebagai pilihan di form & filter)
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('halaqah').select('*').order('urutan');
  if (error) throw new Error(error.message);
  return jsonOk({ data });
});

// POST /api/halaqah { nama, jam_mulai?, jam_selesai?, urutan?, masuk_rapor? }  (admin)
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa menambah halaqah');
  const p = await req.json();
  if (!p.nama || !String(p.nama).trim()) throw new Error('Nama halaqah wajib diisi');
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('halaqah')
    .insert({
      nama: String(p.nama).trim(),
      jam_mulai: p.jam_mulai || null,
      jam_selesai: p.jam_selesai || null,
      urutan: Number(p.urutan) || 1,
      masuk_rapor: p.masuk_rapor !== false,
      aktif: p.aktif !== false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message.includes('duplicate') ? 'Nama halaqah sudah ada' : error.message);
  return jsonOk({ data });
});
