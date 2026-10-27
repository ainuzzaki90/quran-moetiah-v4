-- ============================================================
--  MIGRASI: Fitur Halaqah Pagi & Halaqah Malam
--  Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
--  Aman dijalankan ulang (memakai IF NOT EXISTS / ON CONFLICT).
--  Semua data lama otomatis dimasukkan ke "Halaqah Pagi".
-- ============================================================

-- 1. Tabel halaqah
create table if not exists halaqah (
  id           bigint generated always as identity primary key,
  nama         text not null unique,
  jam_mulai    text,
  jam_selesai  text,
  urutan       int not null default 1,
  masuk_rapor  boolean not null default true,   -- true = nilai dihitung di rapor utama
  aktif        boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table halaqah enable row level security;

insert into halaqah (nama, jam_mulai, jam_selesai, urutan, masuk_rapor) values
  ('Halaqah Pagi',  '07:00', '08:00', 1, true),
  ('Halaqah Malam', '19:30', '20:30', 2, false)
on conflict (nama) do nothing;

-- 2. Kolom halaqah_id di setoran, presensi, penyimak_santri
alter table setoran         add column if not exists halaqah_id bigint references halaqah(id) on delete set null;
alter table presensi        add column if not exists halaqah_id bigint references halaqah(id) on delete set null;
alter table penyimak_santri add column if not exists halaqah_id bigint references halaqah(id) on delete cascade;

-- 3. Data lama -> Halaqah Pagi
update setoran         set halaqah_id = (select id from halaqah where nama = 'Halaqah Pagi') where halaqah_id is null;
update presensi        set halaqah_id = (select id from halaqah where nama = 'Halaqah Pagi') where halaqah_id is null;
update penyimak_santri set halaqah_id = (select id from halaqah where nama = 'Halaqah Pagi') where halaqah_id is null;

-- 4. Relasi binaan: unik per (penyimak, siswa, halaqah)
alter table penyimak_santri drop constraint if exists penyimak_santri_penyimak_id_santri_id_key;
alter table penyimak_santri drop constraint if exists penyimak_santri_unik_halaqah;
alter table penyimak_santri add constraint penyimak_santri_unik_halaqah unique (penyimak_id, santri_id, halaqah_id);

-- 5. Index
create index if not exists idx_setoran_halaqah  on setoran(halaqah_id);
create index if not exists idx_presensi_halaqah on presensi(halaqah_id);
create index if not exists idx_ps_halaqah       on penyimak_santri(halaqah_id);
