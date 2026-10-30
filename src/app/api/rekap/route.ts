import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { parseHalaqahParam, getHalaqahMap } from '@/lib/halaqah';
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

  const hq = parseHalaqahParam(params.get('halaqah_id'));
  const halaqahMap = await getHalaqahMap();
  const { data: setoranAll } = await db.from('setoran').select('*');
  let setoran = (setoranAll || []).filter((s) => {
    const d = new Date(s.tanggal);
    const m = d.getMonth() + 1;
    return d.getFullYear() === tahun && m >= bulanMulai && m <= bulanAkhir;
  });

  const setoranSemuaHalaqah = setoran;
  if (hq) setoran = setoran.filter((s) => String(s.halaqah_id) === hq);
  const { data: presensiAll } = await db.from('presensi').select('santri_id, tanggal, status, halaqah_id');
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
    // Semua halaqah: tampilkan semua guru pengampu siswa (Pagi & Malam), tanpa duplikat
    const relasiList = (penyimakSantriAll || []).filter(
      (r) => String(r.santri_id) === String(santri.id) && (!hq || String(r.halaqah_id) === hq)
    );
    const namaGuru = Array.from(new Set(
      relasiList.map((r) => (usersAll || []).find((u) => String(u.id) === String(r.penyimak_id))?.nama).filter(Boolean)
    ));
    if (namaGuru.length) penyimakNama = namaGuru.join(' & ');
    if (!penyimakNama && rows.length) {
      const freq: Record<string, number> = {};
      rows.forEach((r) => { if (r.penyimak_id) freq[r.penyimak_id] = (freq[r.penyimak_id] || 0) + 1; });
      const topId = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      if (topId) {
        const pUser = (usersAll || []).find((u) => String(u.id) === String(topId));
        if (pUser) penyimakNama = pUser.nama;
      }
    }

    // Halaman/surah terakhir dibagi lintas halaqah (Pagi & Malam)
    const capaian = computeCapaianTerakhir(
      setoranSemuaHalaqah.filter((s) => String(s.santri_id) === String(santri.id)) as any
    );

    // Ringkasan per halaqah (Pagi / Malam dst) -- dicatat terpisah, tidak dicampur ke rata-rata utama
    const ringkasanHalaqah = Object.values(halaqahMap)
      .sort((a: any, b: any) => a.urutan - b.urutan)
      .map((h: any) => {
        const rh = setoranSemuaHalaqah.filter(
          (s) => String(s.santri_id) === String(santri.id) && String(s.halaqah_id) === String(h.id)
        );
        const na = rh.map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
        const rataH = na.length ? na.reduce((a, b) => a + b, 0) / na.length : 0;
        const rel = (penyimakSantriAll || []).find(
          (r) => String(r.santri_id) === String(santri.id) && String(r.halaqah_id) === String(h.id)
        );
        const guru = rel ? (usersAll || []).find((u) => String(u.id) === String(rel.penyimak_id)) : null;
        const pres = (presensiAll || []).filter((p) => {
          const d = new Date(p.tanggal);
          return (
            String(p.santri_id) === String(santri.id) && String(p.halaqah_id) === String(h.id) &&
            d.getFullYear() === tahun && d.getMonth() + 1 >= bulanMulai && d.getMonth() + 1 <= bulanAkhir
          );
        });
        const hadir = pres.filter((p) => (p.status || 'Hadir') === 'Hadir').length;
        return {
          halaqah_id: h.id,
          halaqah_nama: h.nama,
          masuk_rapor: h.masuk_rapor,
          guru_nama: guru ? guru.nama : '',
          total_setoran: rh.length,
          rata_nilai: Math.round(rataH * 100) / 100,
          hadir,
          total_presensi: pres.length,
        };
      });

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
      ringkasan_halaqah: ringkasanHalaqah,
    };
  });

  const taRef = new Date(tahun, bulanMulai === 1 ? 0 : bulanMulai - 1, 1);
  const ta = getTahunAjaran(taRef);

  return jsonOk({ halaqah_id: hq, bulan: periodLabel, tahun, tahun_ajaran: ta.tahun_ajaran, semester: ta.semester, data: hasil });
});
