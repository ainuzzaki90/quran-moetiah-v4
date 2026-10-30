import { getSupabaseAdmin } from './supabase';
import { Bobot, DEFAULT_BOBOT, DEFAULT_POIN_PER_HALAMAN } from './helpers';

export async function getPengaturan(): Promise<{ bobot: Bobot; poin_per_halaman: number }> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('pengaturan').select('kunci, nilai');
  const map: Record<string, any> = {};
  (data || []).forEach((r) => { map[r.kunci] = r.nilai; });
  const b = map['bobot_penilaian'];
  const bobot: Bobot = b && typeof b === 'object'
    ? {
        makharij: Number(b.makharij ?? DEFAULT_BOBOT.makharij),
        tajwid: Number(b.tajwid ?? DEFAULT_BOBOT.tajwid),
        kelancaran: Number(b.kelancaran ?? DEFAULT_BOBOT.kelancaran),
        ketepatan: Number(b.ketepatan ?? DEFAULT_BOBOT.ketepatan),
      }
    : DEFAULT_BOBOT;
  const poin = Number(map['poin_per_halaman']);
  return { bobot, poin_per_halaman: isNaN(poin) ? DEFAULT_POIN_PER_HALAMAN : poin };
}
