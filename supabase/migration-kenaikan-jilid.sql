-- ============================================================
--  MIGRASI: Kenaikan Jilid Ummi (riwayat pengajuan & hasil ujian)
--  Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
--  Aman dijalankan ulang.
-- ============================================================

create table if not exists kenaikan_jilid (
  id             bigint generated always as identity primary key,
  santri_id      bigint not null references santri(id) on delete cascade,
  dari_jilid     text not null,
  ke_jilid       text not null,
  -- diajukan = menunggu ujian; lulus / belum_lulus = hasil; dibatalkan = dibatalkan admin
  status         text not null default 'diajukan' check (status in ('diajukan','lulus','belum_lulus','dibatalkan')),
  diajukan_oleh  bigint references users(id) on delete set null,
  diajukan_pada  timestamptz not null default now(),
  tanggal_ujian  date,
  penguji        text,
  nilai_ujian    numeric,
  catatan        text,
  disahkan_oleh  bigint references users(id) on delete set null,
  disahkan_pada  timestamptz,
  created_at     timestamptz not null default now()
);

-- Satu siswa hanya boleh punya satu pengajuan yang masih menunggu
create unique index if not exists kenaikan_jilid_satu_diajukan
  on kenaikan_jilid (santri_id) where status = 'diajukan';
create index if not exists idx_kenaikan_santri on kenaikan_jilid (santri_id);

alter table kenaikan_jilid enable row level security;
