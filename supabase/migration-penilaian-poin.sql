-- ============================================================
--  MIGRASI: Instrumen penilaian 4 aspek + pengaturan bobot + poin prestasi
--  Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
--  Aman dijalankan ulang.
-- ============================================================

-- Kolom skor aspek baru di setoran (Tajwid & Kelancaran memakai kolom yang sudah ada)
alter table setoran add column if not exists nilai_makharij  numeric;
alter table setoran add column if not exists nilai_ketepatan numeric;

-- Tabel pengaturan (bobot penilaian, poin per halaman, dll)
create table if not exists pengaturan (
  kunci       text primary key,
  nilai       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table pengaturan enable row level security;

insert into pengaturan (kunci, nilai) values
  ('bobot_penilaian',  '{"makharij":15,"tajwid":25,"kelancaran":25,"ketepatan":35}'::jsonb),
  ('poin_per_halaman', '2'::jsonb)
on conflict (kunci) do nothing;
