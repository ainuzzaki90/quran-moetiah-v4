import { UMMI_RUBRIK } from './helpers';

function escapeHtml(v: any): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

function avgN(arr: any[]): number {
  const ns = arr.map((r) => Number(r.nilai)).filter((n) => !isNaN(n) && n > 0);
  return ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : 0;
}
function avgF(arr: any[], f: string): number {
  const ns = arr.map((r) => Number(r[f])).filter((n) => !isNaN(n) && n > 0);
  return ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : 0;
}
function predUmum(n: number): string {
  if (n >= 90) return 'Jayyid Jiddan';
  if (n >= 80) return 'Jayyid';
  if (n >= 70) return 'Maqbul';
  return 'Dhoif';
}

function generateCatatan(d: any, byJ: Record<string, any[]>, hariHadir: number, periodeLabel: string): string {
  const nama = String(d.nama).split(' ')[0];
  const avg = d.rata_nilai;
  const total = d.total_setoran;

  const predMap = avg >= 90 ? ['sangat baik', 'Jayyid Jiddan', 'mempertahankan dan terus meningkatkan kualitas bacaan']
    : avg >= 80 ? ['baik', 'Jayyid', 'terus berlatih agar mencapai predikat Jayyid Jiddan']
    : avg >= 70 ? ['cukup', 'Maqbul', 'meningkatkan intensitas latihan dan memperbanyak murojaah']
    : ['perlu perhatian', 'Dhoif', 'meningkatkan frekuensi setoran dan bimbingan intensif'];

  const aktifKet = hariHadir >= 20 ? 'sangat aktif mengikuti kegiatan setoran'
    : hariHadir >= 15 ? 'cukup aktif mengikuti kegiatan setoran'
    : hariHadir >= 8 ? 'hadir cukup, namun perlu ditingkatkan keaktifannya'
    : 'perlu ditingkatkan kehadirannya dalam kegiatan setoran';

  const kalimatJenis: string[] = [];
  const haf = byJ['Hafalan Baru'], mur = byJ['Murojaah'], til = byJ['Tilawah'];
  if (haf.length) {
    const av = avgN(haf);
    kalimatJenis.push(`hafalan baru ${av >= 85 ? 'menunjukkan hasil yang memuaskan' : 'masih perlu ditingkatkan'} dengan rata-rata nilai ${av}`);
  }
  if (mur.length) {
    const av = avgN(mur);
    kalimatJenis.push(`murojaah berjalan ${av >= 85 ? 'dengan baik dan lancar' : 'cukup lancar namun perlu penguatan'} (rata-rata ${av})`);
  }
  if (til.length) {
    const av = avgN(til);
    kalimatJenis.push(`tilawah ${av >= 85 ? 'sudah baik' : 'perlu diperbaiki'} dengan rata-rata nilai ${av}`);
  }

  let ummiKet = '';
  const ummiRows = byJ['Setoran Metode Ummi'];
  if (ummiRows.length) {
    const hh = ummiRows.map((r) => [Number(r.halaman_mulai) || 0, Number(r.halaman_selesai) || 0]).filter((h) => h[0] || h[1]);
    const halAwal = hh.length ? Math.min(...hh.map((h) => h[0])) : null;
    const halAkhir = hh.length ? Math.max(...hh.map((h) => h[1])) : null;
    const avU = avgN(ummiRows);
    const naik = halAwal && halAkhir && halAkhir > halAwal;
    ummiKet = `Pada penilaian Metode Ummi, Ananda ${naik ? `berhasil menyelesaikan halaman ${halAwal} hingga ${halAkhir}` : `telah mengikuti penilaian Metode Ummi`} dengan rata-rata nilai ${avU} (${avU >= 85 ? 'sangat baik' : avU >= 75 ? 'baik' : 'perlu penguatan'}). `;
  }

  const jenisKet = kalimatJenis.length ? `Untuk jenis setoran lainnya: ${kalimatJenis.join('; ')}. ` : '';

  return `Ananda ${nama} ${aktifKet} pada ${periodeLabel} dengan total ${total} setoran dan rata-rata nilai ${avg} (predikat: ${predMap[1]}). ${ummiKet}${jenisKet}Secara keseluruhan perkembangan Ananda ${predMap[0]}, dan diharapkan untuk ${predMap[2]}.`;
}

export function buildRaporHtml(
  d: any,
  meta: { periodeLabel: string; periodeRangLabel: string; tahunAjaranLabel: string }
): string {
  const now = new Date();
  const BN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tglCetak = `Blora, ${now.getDate()} ${BN[now.getMonth()]} ${now.getFullYear()}`;
  const guruNama = d.penyimak_nama || '..............................';

  const jenisAll = ['Setoran Metode Ummi', 'Hafalan Baru', 'Murojaah', 'Tilawah'];
  const byJ: Record<string, any[]> = {};
  jenisAll.forEach((j) => { byJ[j] = (d.detail || []).filter((r: any) => r.jenis === j); });

  const hariHadir = new Set((d.detail || []).map((r: any) => String(r.tanggal || '').split('T')[0]).filter(Boolean)).size;

  const ummiRows = byJ['Setoran Metode Ummi'];
  let ummiBlock = '';
  if (ummiRows.length) {
    const hh = ummiRows.map((r) => [Number(r.halaman_mulai) || 0, Number(r.halaman_selesai) || 0]).filter((h) => h[0] || h[1]);
    const halAwal = hh.length ? Math.min(...hh.map((h) => h[0])) : '—';
    const halAkhir = hh.length ? Math.max(...hh.map((h) => h[1])) : '—';
    const pFreq: Record<string, number> = {};
    ummiRows.forEach((r) => { if (r.predikat) pFreq[r.predikat] = (pFreq[r.predikat] || 0) + 1; });
    const topP = Object.keys(pFreq).sort((a, b) => pFreq[b] - pFreq[a])[0] || '—';
    const errs = ummiRows.map((r) => {
      const g = UMMI_RUBRIK.find((x) => x.kode === r.predikat || x.label.startsWith(r.predikat || '###'));
      return g ? g.kesalahan : null;
    }).filter((x) => x !== null) as number[];
    const avgErr = errs.length ? Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 10) / 10 : '—';
    ummiBlock = `
      <div class="rp-sec">Penilaian Metode Ummi (Per Halaman)</div>
      <div class="rp-ummi-box">
        <div class="rp-ummi-grid">
          <div class="item"><div class="v">Hal. ${halAwal} → ${halAkhir}</div><div class="l">Progres Halaman</div></div>
          <div class="item"><div class="v">${avgN(ummiRows)}</div><div class="l">Rata-rata Nilai</div></div>
          <div class="item"><div class="v">${topP}</div><div class="l">Nilai Terbanyak</div></div>
          <div class="item"><div class="v">${avgErr}</div><div class="l">Rata-rata Kesalahan</div></div>
        </div>
      </div>`;
  }

  const badgeCls: Record<string, string> = { 'Setoran Metode Ummi': 'b-ummi', 'Hafalan Baru': 'b-hafalan', 'Murojaah': 'b-murajaah', 'Tilawah': 'b-tilawah' };
  const tabelRows = jenisAll.filter((j) => byJ[j].length).map((j) => {
    const rows = byJ[j], isUmmi = j === 'Setoran Metode Ummi';
    const aTajwid = avgF(rows, 'nilai_tajwid');
    const aFashohah = avgF(rows, 'nilai_fashohah');
    const aKelancaran = avgF(rows, 'nilai_kelancaran');
    const subAda = aTajwid > 0 || aFashohah > 0 || aKelancaran > 0;
    const showT = isUmmi ? '—' : (aTajwid || avgN(rows));
    const showF = isUmmi ? '—' : (aFashohah || avgN(rows));
    const showK = isUmmi ? '—' : (aKelancaran || avgN(rows));
    const av = isUmmi ? avgN(rows)
      : (subAda ? Math.round((([aTajwid || avgN(rows), aFashohah || avgN(rows), aKelancaran || avgN(rows)].reduce((a, b) => a + b, 0)) / 3) * 10) / 10
        : avgN(rows));
    return `<tr>
      <td><span class="tf-badge ${badgeCls[j]}">${j}</span></td>
      <td>${rows.length}</td><td>${av}</td><td>${predUmum(av)}</td>
      <td>${showT}</td><td>${showF}</td><td>${showK}</td>
    </tr>`;
  }).join('');

  const barColors: Record<string, string> = { 'Setoran Metode Ummi': '#7c3aed', 'Hafalan Baru': '#0369a1', 'Murojaah': '#b96d12', 'Tilawah': '#1d5d96' };
  const bars = jenisAll.filter((j) => byJ[j].length).map((j) => {
    const v = avgN(byJ[j]), c = barColors[j];
    return `<div class="rp-prog-row">
      <span class="nm" style="color:${c};font-weight:700;">${j}</span>
      <div class="track"><div class="fill" style="width:${v}%;background:${c};"></div></div>
      <span class="num" style="color:${c};">${v}</span>
    </div>`;
  }).join('');

  const catatanText = generateCatatan(d, byJ, hariHadir, meta.periodeLabel);

  return `
    <div class="tf-rapor-a4">
      <div class="rp-kop">
        <div class="rp-kop-logo"><img src="/assets/logo.png" alt="Logo SMP Islam Moetiah"></div>
        <div class="rp-kop-teks">
          <p class="t1">YAYASAN ENCIK MOETIAH MOELJONO</p>
          <p class="t2">SEKOLAH MENENGAH PERTAMA ISLAM MOETIAH</p>
          <p class="t3">Alamat: Jl. Gunung Lawu Lorong I Nomor 20 Sawahan, Kelurahan Tempelan, Kecamatan Blora<br>
            Kabupaten Blora, Provinsi Jawa Tengah, Kode Pos: 58211, Email: smpIslammoetiah@gmail.com
            &nbsp; Website: yayasanmoetiah.org &nbsp; Telephone: 0851 2103 8591
          </p>
        </div>
      </div>

      <div class="rp-judul">
        <h1>Rapor Perkembangan Pembelajaran Al-Qur'an</h1>
        <p>${meta.tahunAjaranLabel}</p>
        <p>${meta.periodeLabel}</p>
      </div>

      <div class="rp-info-box">
        <div class="rp-info-grid">
          <div class="row"><span class="lbl">Nama Siswa</span><span class="col">:</span><span class="val">${escapeHtml(d.nama)}</span></div>
          <div class="row"><span class="lbl">Kelas</span><span class="col">:</span><span class="val">${escapeHtml(d.kelas_nama)}</span></div>
          <div class="row"><span class="lbl">NIS</span><span class="col">:</span><span class="val">${escapeHtml(d.nis)}</span></div>
          <div class="row"><span class="lbl">Level / Jilid Ummi</span><span class="col">:</span><span class="val">${escapeHtml(d.level_ummi)}</span></div>
          <div class="row"><span class="lbl">Halaman Terakhir</span><span class="col">:</span><span class="val">${escapeHtml(d.halaman_terakhir || '-')}</span></div>
          <div class="row"><span class="lbl">Surah Terakhir</span><span class="col">:</span><span class="val">${escapeHtml(d.surah_terakhir || '-')}</span></div>
          <div class="row"><span class="lbl">Guru Pengampu</span><span class="col">:</span><span class="val">${escapeHtml(guruNama)}</span></div>
          <div class="row"><span class="lbl">Periode</span><span class="col">:</span><span class="val">${meta.periodeRangLabel}</span></div>
        </div>
      </div>

      <div class="rp-sec">Ringkasan Setoran Semester</div>
      <div class="rp-cards">
        <div class="rp-card rp-c1"><div class="v">${d.total_setoran}</div><div class="l">Total Setoran</div></div>
        <div class="rp-card rp-c2"><div class="v">${d.rata_nilai}</div><div class="l">Rata-rata Nilai</div></div>
        <div class="rp-card rp-c3"><div class="v">${hariHadir}</div><div class="l">Hari Hadir Setoran</div></div>
        <div class="rp-card rp-c4"><div class="v">${predUmum(d.rata_nilai)}</div><div class="l">Predikat Umum</div></div>
      </div>

      ${ummiBlock}

      <div class="rp-sec">Ringkasan per Jenis Setoran</div>
      <table class="rp-table">
        <thead><tr>
          <th style="text-align:left;">Jenis Setoran</th>
          <th>Jumlah</th><th>Rata-rata Nilai</th><th>Predikat</th>
          <th>Tajwid</th><th>Fashohah</th><th>Kelancaran</th>
        </tr></thead>
        <tbody>${tabelRows || '<tr><td colspan="7" style="text-align:center;">Tidak ada data.</td></tr>'}</tbody>
      </table>

      <div class="rp-sec" style="margin-top:10px;">Grafik Rata-rata Nilai per Jenis</div>
      <div style="margin-bottom:13px;">${bars}</div>

      <div class="rp-sec">Catatan Guru Pengampu</div>
      <div class="rp-catatan" style="font-style:normal;">${escapeHtml(catatanText)}</div>

      <div class="rp-ttd">
        <div class="rp-ttd-col left">
          <span>Orang Tua/Wali</span>
          <div class="rp-ttd-space"></div>
          <span class="rp-ttd-dots">.................................</span>
        </div>
        <div class="rp-ttd-col mid">
          <span>Mengetahui,</span>
          <span>Kepala Sekolah</span>
          <div class="rp-ttd-space"></div>
          <span class="rp-ttd-name">Ramdhan Machmoed, S.S., M.Pd.</span>
        </div>
        <div class="rp-ttd-col right">
          <span>${tglCetak}</span>
          <span>Guru Pengampu,</span>
          <div class="rp-ttd-space"></div>
          <span class="rp-ttd-name">${escapeHtml(guruNama)}</span>
        </div>
      </div>

      <div class="rp-footer">Dicetak otomatis oleh Sistem Tahfiz SMP Islam Moetiah &mdash; Rapor merupakan rekap ringkas per periode.</div>
    </div>
  `;
}
