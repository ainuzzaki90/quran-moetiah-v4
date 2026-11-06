import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getSantriIdsForPenyimak } from '@/lib/relations';
import { parseHalaqahParam } from '@/lib/halaqah';
import { fetchAll } from '@/lib/db-utils';
import { getPengaturan } from '@/lib/pengaturan';
import { hitungKesiapan } from '@/lib/ummi';
import { calcPredikat, LEVEL_JILID_UMMI } from '@/lib/helpers';
import { hariIniWIB, tambahHari, seninMinggu, awalBulan, awalBulanLalu } from '@/lib/tanggal-wib';

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (a: number[]) => (a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : null);
const PREDIKAT = ['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Maqbul', 'Dhoif'];

// GET /api/dashboard/statistik?halaqah_id=&periode=bulan_ini|bulan_lalu|semua
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth(getToken(req));
  const db = getSupabaseAdmin();
  const hq = parseHalaqahParam(req.nextUrl.searchParams.get('halaqah_id'));
  const periode = ['bulan_ini', 'bulan_lalu', 'semua'].includes(req.nextUrl.searchParams.get('periode') || '')
    ? (req.nextUrl.searchParams.get('periode') as string) : 'bulan_ini';
  const role = session.role as string;
  const isAdmin = role === 'admin';
  const isSantri = role === 'santri';
  const bolehDaftarTindakan = !isSantri; // daftar tindakan & papan siswa tidak untuk role Siswa

  // ---- cakupan siswa sesuai role ----
  let santriQ = db.from('santri').select('id, nama, kelas_id, level_ummi');
  if (role === 'penyimak') {
    const ids = (await getSantriIdsForPenyimak(session.user_id)).map(Number);
    if (!ids.length) return jsonOk({ kosong: true });
    santriQ = santriQ.in('id', ids);
  } else if (isSantri) {
    santriQ = santriQ.eq('user_id', session.user_id);
  }
  const { data: santriData, error: sErr } = await santriQ;
  if (sErr) throw new Error(sErr.message);
  const santri = santriData || [];
  if (!santri.length) return jsonOk({ kosong: true });
  const ids = santri.map((s) => s.id);
  const scopeAll = role === 'admin' || role === 'tamu';
  const scope = (q: any) => (scopeAll ? q : q.in('santri_id', ids));
  const withHq = (q: any) => (hq ? q.eq('halaqah_id', hq) : q);

  // ---- rentang tanggal (WIB) ----
  const today = hariIniWIB();
  const bulanIniAwal = awalBulan(today);
  const bulanLaluAwal = awalBulanLalu(today);
  const mingguIni = seninMinggu(today);
  const tren12Awal = tambahHari(mingguIni, -7 * 11);
  const awal60 = tambahHari(today, -60);
  let pAwal: string | null = bulanIniAwal, pAkhir: string = today;
  if (periode === 'bulan_lalu') { pAwal = bulanLaluAwal; pAkhir = tambahHari(bulanIniAwal, -1); }
  if (periode === 'semua') { pAwal = null; }
  const dalamPeriode = (t: string) => (!pAwal || t >= pAwal) && t <= pAkhir;
  const batasBawah = periode === 'semua' ? null : [tren12Awal, bulanLaluAwal, awal60, pAwal || today].sort()[0];

  const pengaturanP = getPengaturan();
  const [setoran, presensi, kelasRes, usersRes, halaqahRes, binaanRes] = await Promise.all([
    fetchAll<any>(() => {
      let q = withHq(scope(db.from('setoran').select('id, santri_id, tanggal, nilai, jenis, penyimak_id, halaqah_id, nilai_makharij, nilai_tajwid, nilai_kelancaran, nilai_ketepatan')));
      if (batasBawah) q = q.gte('tanggal', batasBawah);
      return q.order('id');
    }),
    fetchAll<any>(() => withHq(scope(db.from('presensi').select('id, santri_id, tanggal, status, halaqah_id').gte('tanggal', bulanIniAwal))).order('id')),
    db.from('kelas').select('id, nama_kelas'),
    db.from('users').select('id, nama, role'),
    db.from('halaqah').select('id, nama, urutan, aktif').eq('aktif', true).order('urutan'),
    (isAdmin || role === 'tamu' || role === 'penyimak')
      ? fetchAll<any>(() => db.from('penyimak_santri').select('id, penyimak_id, santri_id, halaqah_id').order('id'))
      : Promise.resolve([] as any[]),
  ]);
  const kelasNama: Record<string, string> = {}; (kelasRes.data || []).forEach((k) => { kelasNama[String(k.id)] = k.nama_kelas; });
  const userNama: Record<string, string> = {}; (usersRes.data || []).forEach((u) => { userNama[String(u.id)] = u.nama; });
  const halaqahList = halaqahRes.data || [];
  const santriMap: Record<string, any> = {}; santri.forEach((s) => { santriMap[String(s.id)] = s; });
  const nilaiOf = (r: any) => { const n = Number(r.nilai); return r.nilai === null || r.nilai === undefined || isNaN(n) ? null : n; };

  // ================= A. KARTU RINGKAS =================
  const setoranMinggu = new Set(setoran.filter((r) => r.tanggal >= mingguIni && r.tanggal <= today).map((r) => r.santri_id));
  const nilaiBulan = (awal: string, akhir: string) => setoran.filter((r) => r.tanggal >= awal && r.tanggal <= akhir).map(nilaiOf).filter((n): n is number => n !== null);
  const rataIni = avg(nilaiBulan(bulanIniAwal, today));
  const rataLalu = avg(nilaiBulan(bulanLaluAwal, tambahHari(bulanIniAwal, -1)));

  const hadirHariIni = halaqahList
    .filter((h) => !hq || String(h.id) === hq)
    .map((h) => {
      const rows = presensi.filter((p) => p.tanggal === today && String(p.halaqah_id) === String(h.id));
      const c = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      rows.forEach((p) => { const st = String(p.status || '').toLowerCase(); if (st === 'hadir') c.hadir++; else if (st === 'izin') c.izin++; else if (st === 'sakit') c.sakit++; else c.alfa++; });
      return { halaqah_id: h.id, nama: h.nama, total: rows.length, ...c };
    });

  let belumGuru: any[] | null = null;
  if (isAdmin) {
    belumGuru = halaqahList.map((h) => {
      const punya = new Set(binaanRes.filter((b: any) => String(b.halaqah_id) === String(h.id)).map((b: any) => b.santri_id));
      return { halaqah_id: h.id, nama: h.nama, belum: santri.filter((s) => !punya.has(s.id)).length };
    });
  }

  let siapUjian: number | null = null;
  if (!isSantri) {
    try {
      const jilid = santri.filter((s) => LEVEL_JILID_UMMI.includes(String(s.level_ummi)));
      if (jilid.length) {
        const peng = await pengaturanP;
        const kes = await hitungKesiapan(jilid, peng);
        // pastikan tabel kenaikan_jilid ada (fitur aktif); jika belum, kartu disembunyikan
        const cek = await db.from('kenaikan_jilid').select('id').limit(1);
        if (cek.error) throw new Error(cek.error.message);
        siapUjian = jilid.filter((s) => kes[String(s.id)]?.siap).length;
      } else siapUjian = 0;
    } catch { siapUjian = null; } // tabel kenaikan_jilid belum dibuat -> kartu disembunyikan
  }

  // ================= B. GRAFIK =================
  const tren: { minggu: string; label: string; jumlah: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const awal = tambahHari(tren12Awal, i * 7);
    const akhir = tambahHari(awal, 6);
    tren.push({ minggu: awal, label: awal.slice(8, 10) + '/' + awal.slice(5, 7), jumlah: setoran.filter((r) => r.tanggal >= awal && r.tanggal <= akhir).length });
  }
  const rowsP = setoran.filter((r) => dalamPeriode(r.tanggal));
  const predikat = PREDIKAT.map((p) => ({ predikat: p, jumlah: rowsP.filter((r) => { const n = nilaiOf(r); return n !== null && calcPredikat(n) === p; }).length }));
  const aspekDef = [['Makharijul Huruf', 'nilai_makharij'], ['Tajwid', 'nilai_tajwid'], ['Kelancaran', 'nilai_kelancaran'], ['Ketepatan', 'nilai_ketepatan']] as const;
  const aspek = aspekDef.map(([label, kol]) => {
    const v = rowsP
      .filter((r) => ['Hafalan Baru', 'Murojaah'].includes(r.jenis) && r[kol] !== null && r[kol] !== undefined && r[kol] !== '')
      .map((r) => Number(r[kol])).filter((n) => !isNaN(n) && r_ok(n));
    return { aspek: label, rata: avg(v), jumlah: v.length };
  });
  const perKelasMap: Record<string, { n: number[]; jumlah: number; siswa: Set<number> }> = {};
  rowsP.forEach((r) => {
    const s = santriMap[String(r.santri_id)]; if (!s) return;
    const k = kelasNama[String(s.kelas_id)] || '(tanpa kelas)';
    const e = (perKelasMap[k] = perKelasMap[k] || { n: [], jumlah: 0, siswa: new Set() });
    e.jumlah++; e.siswa.add(r.santri_id);
    const n = nilaiOf(r); if (n !== null) e.n.push(n);
  });
  const perKelas = Object.entries(perKelasMap).map(([kelas, e]) => ({ kelas, jumlah: e.jumlah, siswa_setor: e.siswa.size, rata: avg(e.n) })).sort((a, b) => b.jumlah - a.jumlah);

  // ================= C. DAFTAR TINDAKAN =================
  let dhoifBerulang: any[] = []; let presensiPerhatian: any[] = [];
  let rajin: any[] = [];
  if (bolehDaftarTindakan) {
    const bySantri: Record<string, any[]> = {};
    setoran.filter((r) => r.tanggal >= awal60 && nilaiOf(r) !== null).forEach((r) => { (bySantri[String(r.santri_id)] = bySantri[String(r.santri_id)] || []).push(r); });
    Object.entries(bySantri).forEach(([sid, rows]) => {
      const last3 = rows.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.id - a.id)).slice(0, 3);
      const dh = last3.filter((r) => nilaiOf(r)! < 60).length;
      if (dh >= 2) {
        const s = santriMap[sid];
        dhoifBerulang.push({ santri_id: Number(sid), nama: s?.nama || '-', kelas: kelasNama[String(s?.kelas_id)] || '-', dhoif: dh, dari: last3.length, rata: avg(last3.map((r) => nilaiOf(r)!)) });
      }
    });
    dhoifBerulang = dhoifBerulang.sort((a, b) => b.dhoif - a.dhoif || (a.rata ?? 0) - (b.rata ?? 0)).slice(0, 15);

    const pBy: Record<string, { hadir: number; izin: number; sakit: number; alfa: number }> = {};
    presensi.forEach((p) => {
      const e = (pBy[String(p.santri_id)] = pBy[String(p.santri_id)] || { hadir: 0, izin: 0, sakit: 0, alfa: 0 });
      const st = String(p.status || '').toLowerCase();
      if (st === 'hadir') e.hadir++; else if (st === 'izin') e.izin++; else if (st === 'sakit') e.sakit++; else e.alfa++;
    });
    presensiPerhatian = Object.entries(pBy)
      .map(([sid, e]) => ({ santri_id: Number(sid), nama: santriMap[sid]?.nama || '-', kelas: kelasNama[String(santriMap[sid]?.kelas_id)] || '-', ...e, tidak_hadir: e.izin + e.sakit + e.alfa }))
      .filter((e) => e.tidak_hadir > 0)
      .sort((a, b) => b.alfa - a.alfa || b.tidak_hadir - a.tidak_hadir)
      .slice(0, 10);

    // ---- D. rajin setor (hari berbeda dalam periode) ----
    const hari: Record<string, Set<string>> = {};
    rowsP.forEach((r) => { (hari[String(r.santri_id)] = hari[String(r.santri_id)] || new Set()).add(r.tanggal); });
    rajin = Object.entries(hari)
      .map(([sid, set]) => ({ santri_id: Number(sid), nama: santriMap[sid]?.nama || '-', kelas: kelasNama[String(santriMap[sid]?.kelas_id)] || '-', hari_setor: set.size }))
      .sort((a, b) => b.hari_setor - a.hari_setor).slice(0, 10);
  }

  // ================= D. PERBANDINGAN GURU (admin) =================
  let banding: any[] | null = null;
  if (isAdmin) {
    const gurus = (usersRes.data || []).filter((u) => u.role === 'penyimak');
    banding = gurus.map((g) => {
      const binaan = new Set(binaanRes.filter((b: any) => b.penyimak_id === g.id && (!hq || String(b.halaqah_id) === hq)).map((b: any) => b.santri_id));
      const rows = rowsP.filter((r) => r.penyimak_id === g.id);
      const n = rows.map(nilaiOf).filter((x): x is number => x !== null);
      return { penyimak_id: g.id, nama: g.nama, siswa_binaan: binaan.size, setoran: rows.length, rata: avg(n) };
    }).filter((g) => g.siswa_binaan > 0 || g.setoran > 0).sort((a, b) => b.setoran - a.setoran);
  }

  return jsonOk({
    periode, periode_label: periode === 'bulan_ini' ? 'Bulan ini' : periode === 'bulan_lalu' ? 'Bulan lalu' : 'Semua waktu',
    hari_ini: today, total_siswa: santri.length,
    kartu: {
      aktif_minggu: setoranMinggu.size, hadir_hari_ini: hadirHariIni,
      rata_bulan_ini: rataIni, rata_bulan_lalu: rataLalu, belum_guru: belumGuru, siap_ujian: siapUjian,
    },
    tren, predikat, aspek, per_kelas: perKelas,
    dhoif_berulang: bolehDaftarTindakan ? dhoifBerulang : null,
    presensi_perhatian: bolehDaftarTindakan ? presensiPerhatian : null,
    rajin: bolehDaftarTindakan ? rajin : null,
    banding_guru: banding,
  });
});

function r_ok(n: number) { return n >= 0 && n <= 100; }
