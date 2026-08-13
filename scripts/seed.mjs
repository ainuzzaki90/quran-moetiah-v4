// scripts/seed.mjs
// Membuat akun admin default: username "admin", password "admin123".
// Jalankan setelah `npm install` dan setelah supabase/schema.sql dieksekusi:
//   node scripts/seed.mjs
// Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah diset (mis. lewat file .env.local + `node --env-file=.env.local scripts/seed.mjs`).

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di environment.');
  console.error('Contoh: node --env-file=.env.local scripts/seed.mjs');
  process.exit(1);
}

const db = createClient(url, key);

async function main() {
  const { data: existing } = await db.from('users').select('id').eq('username', 'admin').maybeSingle();
  if (existing) {
    console.log('Akun admin sudah ada, tidak membuat ulang.');
    return;
  }
  const hash = await bcrypt.hash('admin123', 10);
  const { error } = await db.from('users').insert({
    nama: 'Administrator',
    username: 'admin',
    password_hash: hash,
    role: 'admin',
    status: 'aktif',
  });
  if (error) {
    console.error('Gagal membuat akun admin:', error.message);
    process.exit(1);
  }
  console.log('Akun admin berhasil dibuat -> username: admin, password: admin123');
  console.log('SEGERA ganti password ini setelah login pertama kali lewat menu Pengguna.');
}

main();
