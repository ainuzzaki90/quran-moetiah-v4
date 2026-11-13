# Laporan Audit Tahap 1 — 13 Nov 2026

Cakupan: hak akses seluruh endpoint API (31 route), keamanan akun/sesi, dependensi, header, XSS.

## Diperbaiki
| # | Tingkat | Temuan | Perbaikan |
|---|---|---|---|
| 1 | Genting | Hapus setoran (`DELETE /api/setoran/[id]`) tidak memeriksa peran: akun Siswa/Tamu bisa menghapus setoran siapa pun lewat permintaan langsung | Hanya admin/penyimak; penyimak hanya miliknya sendiri |
| 2 | Genting | Ubah setoran (`PUT`) tidak memeriksa peran (diperbaiki sebelumnya, bersama Audit Log) | Hanya admin/penyimak |
| 3 | Sedang | Akun dinonaktifkan / peran diubah / password direset tidak mengeluarkan sesi yang sedang aktif (berlaku sampai 8 jam) | Semua sesi akun itu dicabut seketika |
| 4 | Rendah | Hapus presensi tanpa pemeriksaan peran | Hanya admin/penyimak |
| 5 | Rendah | Belum ada header keamanan; respons API bisa di-cache | Ditambah nosniff, anti-iframe, referrer, permissions; `Cache-Control: no-store` untuk /api |
| 6 | Sedang | Paket `dompurify` (via pembuat PDF) dan `source-map-js` rentan | Diperbarui lewat `npm audit fix` |

## Belum diubah (perlu keputusan)
- Next.js 14.2.35 (versi 14 terakhir) punya banyak advisori; perbaikan hanya di Next 15/16 (perubahan besar). Sebagian besar menyangkut fitur yang tidak dipakai aplikasi (next/image, Server Actions, rewrites, i18n).
- `xlsx` (SheetJS) punya advisori tanpa perbaikan di npm; risiko hanya saat membuka file Excel tidak tepercaya (upload hanya admin).
- Guru (penyimak) bisa menginput setoran dan mengubah setoran untuk siswa yang bukan binaannya di sisi server (tampilan hanya menampilkan binaan). Hapus sudah dibatasi ke miliknya sendiri.
- Guru bisa mengedit data siswa mana pun termasuk Level Ummi (melewati alur Kenaikan Jilid).
- Penguncian login per username: pihak luar bisa mengunci akun orang lain 15 menit dengan 5 kali salah.
- Password awal 123456 / NIS: dibiarkan sesuai keputusan pemilik.

## Sudah baik
- Semua tabel memakai RLS tanpa kebijakan; akses data hanya lewat server (service role). Tidak ada kunci rahasia di kode.
- Password di-hash bcrypt; sesi memakai UUID acak, kedaluwarsa 8 jam; login dibatasi 5 percobaan.
- Rapor/PDF/toast meng-escape data; tidak ada penggunaan HTML mentah dari input pengguna.
