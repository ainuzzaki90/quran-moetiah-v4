-- ============================================================
--  MIGRASI: Hafalan Awal (surat yang sudah dihafal sebelum aplikasi dipakai)
--  Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
--  Aman dijalankan ulang.
-- ============================================================
create table if not exists hafalan_awal (
  id          bigint generated always as identity primary key,
  santri_id   bigint not null references santri(id) on delete cascade,
  surah_no    int not null check (surah_no between 1 and 114),
  created_at  timestamptz not null default now(),
  unique (santri_id, surah_no)
);
create index if not exists idx_hafalan_awal_santri on hafalan_awal(santri_id);
alter table hafalan_awal enable row level security;
