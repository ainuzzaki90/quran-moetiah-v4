import { getSupabaseAdmin } from './supabase';

export { AKSI_LABEL } from './audit-label';

const SENSITIF = ['password', 'password_hash'];
function bersih(o: any) {
  if (!o || typeof o !== 'object') return o ?? null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) if (!SENSITIF.includes(k)) out[k] = v;
  return out;
}

/** Bandingkan dua objek; kembalikan hanya kolom yang berubah. */
export function bedaField(sebelum: Record<string, any>, sesudah: Record<string, any>, kolom?: string[]) {
  const a: Record<string, any> = {}, b: Record<string, any> = {};
  const keys = kolom || Array.from(new Set([...Object.keys(sebelum || {}), ...Object.keys(sesudah || {})]));
  for (const k of keys) {
    if (SENSITIF.includes(k)) continue;
    const x = sebelum?.[k] ?? null, y = sesudah?.[k] ?? null;
    if (JSON.stringify(x) !== JSON.stringify(y)) { a[k] = x; b[k] = y; }
  }
  return { sebelum: a, sesudah: b, berubah: Object.keys(a).length > 0 };
}

export type AuditInput = {
  aksi: string; objek_id?: string | number | null; santri_id?: number | null; santri_nama?: string | null;
  ringkasan?: string; sebelum?: any; sesudah?: any;
};

/**
 * Mencatat satu kejadian. Tidak pernah melempar error: kalau tabel belum dibuat atau ada gangguan,
 * proses utama (simpan setoran dst.) tetap berjalan.
 */
export async function logAudit(session: { user_id: number; role: string }, inputs: AuditInput | AuditInput[]) {
  try {
    const db = getSupabaseAdmin();
    const { data: u } = await db.from('users').select('nama').eq('id', session.user_id).maybeSingle();
    const list = Array.isArray(inputs) ? inputs : [inputs];
    const rows = list.map((i) => ({
      user_id: session.user_id, user_nama: u?.nama || null, user_role: session.role,
      aksi: i.aksi, objek_id: i.objek_id != null ? String(i.objek_id) : null,
      santri_id: i.santri_id ?? null, santri_nama: i.santri_nama ?? null,
      ringkasan: (i.ringkasan || '').slice(0, 500),
      sebelum: bersih(i.sebelum), sesudah: bersih(i.sesudah),
    }));
    if (rows.length) await db.from('audit_log').insert(rows);
  } catch { /* abaikan */ }
}

export async function namaSiswa(id: number | string | null | undefined): Promise<string | null> {
  if (!id) return null;
  try {
    const { data } = await getSupabaseAdmin().from('santri').select('nama').eq('id', id).maybeSingle();
    return data?.nama || null;
  } catch { return null; }
}

export function ringkasSetoran(r: any) {
  const isi = r.jenis === 'Setoran Metode Ummi'
    ? `Hal. ${r.halaman_mulai ?? '-'}–${r.halaman_selesai ?? '-'}`
    : `${r.surah || '-'} ${r.ayat_mulai ?? ''}–${r.ayat_selesai ?? ''}`.trim();
  return `${r.jenis} · ${isi} · nilai ${r.nilai ?? '-'}${r.predikat ? ` (${r.predikat})` : ''}`;
}
