import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { tambahHari } from '@/lib/tanggal-wib';

const TABEL_HILANG = 'Tabel audit_log belum dibuat. Jalankan supabase/migration-audit-log.sql di Supabase SQL Editor.';
const PER_HALAMAN = 50;

// GET /api/audit-log?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&user_id=&aksi=&q=&page=1  (admin saja)
// Log yang lebih dari 12 bulan dibersihkan otomatis di sini.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  if (session.role !== 'admin') throw new Error('Hanya admin yang bisa melihat Audit Log');
  const db = getSupabaseAdmin();
  const sp = req.nextUrl.searchParams;

  const batas = new Date(); batas.setMonth(batas.getMonth() - 12);
  const { error: errDel } = await db.from('audit_log').delete().lt('created_at', batas.toISOString());
  if (errDel && /relation|does not exist|schema cache/i.test(errDel.message)) throw new Error(TABEL_HILANG);

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const semuaHalaman = sp.get('semua') === '1'; // untuk ekspor Excel
  let q = db.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false });
  const dari = sp.get('dari'), sampai = sp.get('sampai');
  if (dari && /^\d{4}-\d{2}-\d{2}$/.test(dari)) q = q.gte('created_at', `${dari}T00:00:00+07:00`);
  if (sampai && /^\d{4}-\d{2}-\d{2}$/.test(sampai)) q = q.lt('created_at', `${tambahHari(sampai, 1)}T00:00:00+07:00`);
  if (sp.get('user_id')) q = q.eq('user_id', sp.get('user_id')!);
  const aksi = sp.get('aksi');
  if (aksi) q = aksi.endsWith('.*') ? q.like('aksi', `${aksi.slice(0, -1)}%`) : q.eq('aksi', aksi);
  const kata = (sp.get('q') || '').trim().replace(/[%,()]/g, ' ');
  if (kata) q = q.or(`santri_nama.ilike.%${kata}%,ringkasan.ilike.%${kata}%,user_nama.ilike.%${kata}%`);
  q = semuaHalaman ? q.range(0, 4999) : q.range((page - 1) * PER_HALAMAN, page * PER_HALAMAN - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? TABEL_HILANG : error.message);

  const { data: pelaku } = await db.from('audit_log').select('user_id, user_nama').not('user_id', 'is', null).limit(5000);
  const map = new Map<number, string>();
  (pelaku || []).forEach((r: any) => { if (!map.has(r.user_id)) map.set(r.user_id, r.user_nama || `#${r.user_id}`); });
  return jsonOk({ data: data || [], total: count ?? 0, per_halaman: PER_HALAMAN, pelaku: Array.from(map, ([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama)) });
});
