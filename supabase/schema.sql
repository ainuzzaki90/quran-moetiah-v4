-- ============================================================
--  MOETIAH QURAN APP v2 — Skema Database Supabase (Postgres)
--  Mirror 1:1 dari struktur backend Apps Script lama (Code.gs):
--  Users, Kelas, Santri, Setoran, Sessions, PenyimakSantri, Presensi
--
--  CARA PAKAI:
--  1. Buka Supabase Dashboard -> SQL Editor -> New Query.
--  2. Paste seluruh isi file ini -> Run.
--  3. Aman dijalankan sekali. Untuk migrasi ulang, hapus dulu tabelnya.
-- ============================================================

-- ============== KELAS ==============
create table if not exists kelas (
  id            bigint generated always as identity primary key,
  nama_kelas    text not null,
  penyimak_id   bigint,
  created_at    timestamptz not null default now()
);

-- ============== USERS (admin, penyimak, santri, tamu) ==============
create table if not exists users (
  id            bigint generated always as identity primary key,
  nama          text not null,
  username      text not null unique,
  password_hash text not null,
  role          text not null check (role in ('admin','penyimak','santri','tamu')),
  kelas_id      bigint references kelas(id) on delete set null,
  status        text not null default 'aktif' check (status in ('aktif','nonaktif')),
  created_at    timestamptz not null default now()
);

alter table kelas
  add constraint kelas_penyimak_id_fkey foreign key (penyimak_id) references users(id) on delete set null;

-- ============== SANTRI ==============
create table if not exists santri (
  id             bigint generated always as identity primary key,
  nama           text not null,
  nis            text,
  kelas_id       bigint references kelas(id) on delete set null,
  jenis_kelamin  text,
  tanggal_lahir  date,
  user_id        bigint references users(id) on delete set null,
  level_ummi     text,
  created_at     timestamptz not null default now()
);

-- ============== SETORAN ==============
create table if not exists setoran (
  id                bigint generated always as identity primary key,
  tanggal           date not null,
  santri_id         bigint not null references santri(id) on delete cascade,
  kelas_id          bigint references kelas(id) on delete set null,
  penyimak_id       bigint references users(id) on delete set null,
  jenis             text not null check (jenis in ('Setoran Metode Ummi','Hafalan Baru','Murojaah','Tilawah')),
  surah             text,
  ayat_mulai        text,
  surah_selesai     text,
  ayat_selesai      text,
  halaman_mulai     text,
  halaman_selesai   text,
  nilai             numeric,
  predikat          text,
  nilai_tajwid      numeric,
  nilai_fashohah    numeric,
  nilai_kelancaran  numeric,
  catatan           text,
  created_at        timestamptz not null default now()
);

-- ============== PENYIMAK <-> SANTRI (relasi binaan, many-to-many) ==============
create table if not exists penyimak_santri (
  id           bigint generated always as identity primary key,
  penyimak_id  bigint not null references users(id) on delete cascade,
  santri_id    bigint not null references santri(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (penyimak_id, santri_id)
);

-- ============== PRESENSI ==============
create table if not exists presensi (
  id           uuid primary key default gen_random_uuid(),
  tanggal      date not null,
  kelas_id     bigint references kelas(id) on delete set null,
  penyimak_id  bigint references users(id) on delete set null,
  santri_id    bigint not null references santri(id) on delete cascade,
  status       text not null default 'Hadir' check (status in ('Hadir','Izin','Sakit','Alfa')),
  materi       text,
  catatan      text,
  created_at   timestamptz not null default now()
);

-- ============== SESSIONS (token login, menggantikan sheet Sessions) ==============
create table if not exists sessions (
  token       uuid primary key default gen_random_uuid(),
  user_id     bigint not null references users(id) on delete cascade,
  role        text not null,
  kelas_id    bigint,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ============== LOGIN ATTEMPTS (proteksi brute-force, ganti CacheService) ==============
create table if not exists login_attempts (
  username     text primary key,
  attempts     int not null default 0,
  locked_until timestamptz
);

-- ============== INDEX ==============
create index if not exists idx_setoran_santri on setoran(santri_id);
create index if not exists idx_setoran_tanggal on setoran(tanggal);
create index if not exists idx_presensi_santri on presensi(santri_id);
create index if not exists idx_presensi_tanggal on presensi(tanggal);
create index if not exists idx_penyimak_santri_penyimak on penyimak_santri(penyimak_id);
create index if not exists idx_sessions_expires on sessions(expires_at);

-- ============================================================
--  Row Level Security: DITUTUP dari akses langsung client-side.
--  Semua akses data lewat API route Next.js (server-side, pakai
--  Supabase service role key), persis seperti Apps Script yang
--  jadi satu-satunya pintu masuk ke Google Sheets dulu. Jadi RLS
--  cukup diaktifkan tanpa policy publik supaya anon key browser
--  tidak bisa baca/tulis apa pun langsung ke tabel.
-- ============================================================
alter table users enable row level security;
alter table kelas enable row level security;
alter table santri enable row level security;
alter table setoran enable row level security;
alter table penyimak_santri enable row level security;
alter table presensi enable row level security;
alter table sessions enable row level security;
alter table login_attempts enable row level security;

-- ============== AKUN ADMIN DEFAULT ==============
-- Password default: admin123 (di-hash dengan bcrypt saat setup pertama kali
-- lewat endpoint POST /api/auth/login otomatis membuat sesi; tapi baris user
-- ini perlu dibuat manual sekali karena bcrypt hash dibuat di sisi Node, bukan
-- SQL). Jalankan skrip `npm run seed` (lihat README) setelah `npm install`
-- untuk membuat akun admin ini secara otomatis dengan password ter-hash benar.
