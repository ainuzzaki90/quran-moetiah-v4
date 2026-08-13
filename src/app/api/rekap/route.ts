import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { computeCapaianTerakhir, getTahunAjaran } from '@/lib/helpers';

// GET /api/rekap?tahun=&bulan=&bulan_mulai=&bulan_akhir=&kelas_id=&santri_id=
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;

  const tahun = Number(params.get('tahun'));
  const bulanTunggal = params.get('bulan');
  const bulanMulai = Number(params.get('bulan_mulai') || bulanTunggal || 1);
  const bulanAkhir = Number(params.get('bulan_akhir') || bulanTunggal || 12);
  const periodLabel = bulanMulai === bulanAkhir ? bulanTunggal : `${bulanMulai}-${bulanAkhir}`;

  const { data: setoranAll } = await db.from('setoran').select('*');
  let setoran = (setoranAll || []).filter((s) => {
    const d = new Date(s.tanggal);
    const m = d.getMonth() + 1;
    return d.getFullYear() === tahun && m >= bulanMulai && m <= bulanAkhir;
  });

  const { data: santriAll } = await db.from('santri').select('*');
  let santriList = santriAll || [];
  const { data: kelasAll } = await db.from('kelas').select('*');
  const { data: usersAll } = await db.from('users').select('id, nama');
  const { data: penyimakSantriAll } = await db.from('penyimak_santri').select('*');

  if (session.role === 'penyimak') {
    const binaanIds = await getSantriIdsForPenyimak(session.user_id);
    setoran = setoran.filter((s) => binaanIds.includes(String(s.santri_id)));
    santriList = santriList.filter((s) => binaanIds.includes(String(s.id)));
  } else if (session.role === 'santri') {
    const me = santriList.find((s) => String(s.user_id) === String(session.user_id));
    santriList = me ? [me] : [];
    setoran = setoran.filter((s) => me && String(s.santri_id) === String(me.id));
  }
  if (params.get('kelas_id')) santriList = santriList.filter((s) => String(s.kelas_id) === String(params.get('kelas_id')));
  if (params.get('santri_id')) santriList = santriList.filter((s) => String(s.id) === String(params.get('santri_id')));

  const hasil = santriList.map((santri) => {
    const rows = setoran
      .filter((s) => String(s.santri_id) === String(santri.id))
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
    const nilaiArr = rows.map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
    const rata = nilaiArr.length ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length : 0;
    const kelas = (kelasAll || []).find((k) => String(k.id) === String(santri.kelas_id));

    let penyimakNama = '';
    const relasi = (penyimakSantriAll || []).find((r) => String(r.santri_id) === String(santri.id));
    if (relasi) {
      const pUser = (usersAll || []).find((u) => String(u.id) === String(relasi.penyimak_id));
      if (pUser) penyimakNama = pUser.nama;
    }
    if (!penyimakNama && rows.length) {
      const freq: Record<string, number> = {};
      rows.forEach((r) => { if (r.penyimak_id) freq[r.penyimak_id] = (freq[r.penyimak_id] || 0) + 1; });
      const topId = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      if (topId) {
        const pUser = (usersAll || []).find((u) => String(u.id) === String(topId));
        if (pUser) penyimakNama = pUser.nama;
      }
    }

    const capaian = computeCapaianTerakhir(rows as any);

    return {
      santri_id: santri.id,
      nama: santri.nama,
      nis: santri.nis,
      kelas_nama: kelas ? kelas.nama_kelas : '',
      level_ummi: santri.level_ummi || '',
      penyimak_nama: penyimakNama,
      total_setoran: rows.length,
      rata_nilai: Math.round(rata * 100) / 100,
      halaman_terakhir: capaian.halaman ? capaian.halaman.label : '-',
      surah_terakhir: capaian.surah ? capaian.surah.label : '-',
      detail: rows,
    };
  });

  const taRef = new Date(tahun, bulanMulai === 1 ? 0 : bulanMulai - 1, 1);
  const ta = getTahunAjaran(taRef);

  return jsonOk({ bulan: periodLabel, tahun, tahun_ajaran: ta.tahun_ajaran, semester: ta.semester, data: hasil });
});
