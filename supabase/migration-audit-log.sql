-- Audit Log (versi ringan): jejak perubahan setoran, kenaikan jilid, pengaturan penilaian, dan akun pengguna.
-- Jalankan sekali di Supabase: SQL Editor -> New query -> tempel -> Run.
create table if not exists audit_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  user_id      bigint,
  user_nama    text,
  user_role    text,
  aksi         text not null,
  objek_id     text,
  santri_id    bigint,
  santri_nama  text,
  ringkasan    text,
  sebelum      jsonb,
  sesudah      jsonb
);
create index if not exists idx_audit_created on audit_log(created_at desc);
create index if not exists idx_audit_user on audit_log(user_id);
create index if not exists idx_audit_aksi on audit_log(aksi);
alter table audit_log enable row level security;  -- hanya server (service role) yang boleh akses

-- Pembersihan: log lebih dari 12 bulan dihapus otomatis oleh aplikasi (saat admin membuka Audit Log).
