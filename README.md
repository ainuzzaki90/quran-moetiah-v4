# Moetiah Quran App v2

Aplikasi manajemen setoran, presensi, statistik, progress, dan rapor tahfidz
Al-Qur'an untuk **SMP Islam Moetiah**. Dibangun ulang dari nol menggantikan
backend Google Sheets + Apps Script, dengan fitur yang sama persis:

- Role: **admin**, **penyimak**, **santri**, **tamu**
- Setoran metode Ummi (per halaman) & hafalan Al-Qur'an (per surah/ayat),
  lengkap dengan rubrik penilaian dan predikat otomatis
- Presensi per kelas/penyimak
- Statistik (harian/pekanan/bulanan) + peringkat santri
- Progress siswa (tren nilai & kehadiran)
- Rekap & rapor bulanan berbasis tahun ajaran (Juli–Juni)
- Mushaf Digital 604 halaman (standar Madinah) via api.alquran.cloud
- Manajemen data siswa, kelas, dan pengguna
- Tema, logo, dan teks copyright sama persis dengan versi lama

**Stack:** Next.js 14 (App Router + API Routes) · Supabase (Postgres) · Vercel

---

## 1. Setup Supabase

1. Buka [supabase.com](https://supabase.com) → project Anda (atau buat baru).
2. Masuk ke **SQL Editor** → **New query**.
3. Copy-paste seluruh isi file `supabase/schema.sql` → **Run**.
   Ini akan membuat semua tabel (`users`, `kelas`, `santri`, `setoran`,
   `presensi`, `penyimak_santri`, `sessions`, `login_attempts`) beserta index
   dan RLS.
4. Buka **Project Settings → API**, catat:
   - `Project URL` → jadi `SUPABASE_URL`
   - `service_role` key (bukan `anon` key!) → jadi `SUPABASE_SERVICE_ROLE_KEY`

> Kenapa `service_role`, bukan `anon`? Karena semua akses data lewat API
> route Next.js (server-side) — persis seperti Apps Script dulu yang jadi
> satu-satunya pintu masuk ke Google Sheets. RLS diaktifkan tanpa policy
> publik supaya key `anon` di browser tidak bisa baca/tulis apa pun langsung.

## 2. Setup lokal & buat akun admin

```bash
npm install
cp .env.example .env.local
# edit .env.local, isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY

node --env-file=.env.local scripts/seed.mjs
```

Ini membuat akun admin default:
- **username:** `admin`
- **password:** `admin123`

Segera login dan ganti password ini lewat menu **Pengguna**.

Jalankan lokal untuk mencoba:

```bash
npm run dev
# buka http://localhost:3000
```

## 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Moetiah Quran App v2 - initial build"
git branch -M main
git remote add origin https://github.com/<username-anda>/moetiah-quran-app-v2.git
git push -u origin main
```

(`.env.local` sudah otomatis diabaikan lewat `.gitignore` — kredensial
Supabase tidak akan ikut ter-commit.)

## 4. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → **Add New → Project**.
2. Import repo GitHub `moetiah-quran-app-v2` yang barusan di-push.
3. Di bagian **Environment Variables**, tambahkan:
   - `SUPABASE_URL` = (Project URL dari langkah 1)
   - `SUPABASE_SERVICE_ROLE_KEY` = (service_role key dari langkah 1)
4. Klik **Deploy**.
5. Setelah selesai, buka domain Vercel yang diberikan (atau hubungkan
   domain kustom seperti `quran-moetiah.my.id` lewat **Settings → Domains**).

Setiap kali Anda `git push` ke `main`, Vercel otomatis build & deploy ulang.

## 5. Struktur proyek

```
src/
  app/
    page.tsx              # entry point (render AppShell)
    layout.tsx             # <html>, font, metadata
    globals.css             # tema (disalin persis dari versi lama)
    api/                    # seluruh backend (pengganti Code.gs)
      auth/login, auth/logout
      santri, santri/[id]
      kelas, kelas/[id]
      users, users/[id]
      setoran, setoran/[id]
      presensi, presensi/rekap
      statistik
      rekap
      progress
      dashboard
      penyimak-santri
  components/
    AppShell.tsx            # state utama (login, sidebar, switch view)
    Login.tsx, Sidebar.tsx, Topbar.tsx
    views/                   # satu file per menu
  lib/
    supabase.ts              # koneksi Supabase (server-only)
    auth.ts                   # login, sesi, bcrypt, proteksi brute-force
    helpers.ts                 # predikat, rubrik Ummi, tahun ajaran, dll
    relations.ts                # relasi penyimak <-> santri
    api-client.ts                 # fetch wrapper sisi frontend
    menu.ts                        # daftar menu per role
supabase/
  schema.sql                       # skema database lengkap
scripts/
  seed.mjs                          # buat akun admin default
```

## 6. Catatan migrasi dari Apps Script

- Semua nama _action_ dari `Router.gs` lama dipetakan 1:1 ke API route di
  atas — logika bisnis (predikat, capaian terakhir, tahun ajaran, rubrik
  Ummi, statistik, rekap) dipindah langsung dari `Helpers.gs` /
  `Actions_*.gs` ke `src/lib/helpers.ts` dan masing-masing route.
- `CacheService` (proteksi brute-force login) diganti tabel `login_attempts`.
- Sheet `Sessions` diganti tabel `sessions` di Postgres (token = UUID,
  masa berlaku 8 jam, sama seperti sebelumnya).
- Password lama (jika ada) tidak ikut dimigrasikan otomatis — ini
  pembangunan dari nol sesuai permintaan, bukan migrasi data. Buat ulang
  akun pengguna lewat menu **Pengguna** setelah login sebagai admin.
- Logo, ikon PWA, tema warna (navy-gold), font Amiri, dan teks footer
  copyright disalin persis dari repo `ainuzzaki90/quran-moetiah`.

---

© {TAHUN} SMP Islam Moetiah — dikembangkan oleh Abdal Ainuz Zaki, B.A.
