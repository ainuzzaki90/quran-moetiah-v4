import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from './supabase';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 jam, sama seperti versi lama
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

export type SessionUser = {
  token: string;
  user_id: number;
  role: 'admin' | 'penyimak' | 'santri' | 'tamu';
  kelas_id: number | null;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// ---------- Proteksi brute-force (per username, tabel login_attempts) ----------
async function getLoginAttempts(username: string) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('login_attempts')
    .select('attempts, locked_until')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle();
  if (!data) return 0;
  if (data.locked_until && new Date(data.locked_until) < new Date()) return 0;
  return data.attempts;
}

async function registerFailedLogin(username: string) {
  const db = getSupabaseAdmin();
  const key = username.toLowerCase().trim();
  const current = await getLoginAttempts(key);
  const attempts = current + 1;
  const lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_SECONDS * 1000).toISOString();
  await db.from('login_attempts').upsert({ username: key, attempts, locked_until: lockedUntil });
  return attempts;
}

async function clearLoginAttempts(username: string) {
  const db = getSupabaseAdmin();
  await db.from('login_attempts').delete().eq('username', username.toLowerCase().trim());
}

// ---------- Sesi ----------
export async function createSession(user: { id: number; role: string; kelas_id: number | null }) {
  const db = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const { data, error } = await db
    .from('sessions')
    .insert({ user_id: user.id, role: user.role, kelas_id: user.kelas_id, expires_at: expiresAt })
    .select('token')
    .single();
  if (error) throw new Error(error.message);
  return data.token as string;
}

export async function getSessionUser(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getSupabaseAdmin();
  const { data } = await db.from('sessions').select('*').eq('token', token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return {
    token: data.token,
    user_id: data.user_id,
    role: data.role,
    kelas_id: data.kelas_id,
  };
}

export class AuthError extends Error {}

export async function requireAuth(token: string | null | undefined): Promise<SessionUser> {
  const session = await getSessionUser(token);
  if (!session) throw new AuthError('Sesi tidak valid atau kedaluwarsa, silakan login ulang');
  return session;
}

export async function cleanExpiredSessions() {
  const db = getSupabaseAdmin();
  await db.from('sessions').delete().lt('expires_at', new Date().toISOString());
}

// ---------- Actions ----------
export async function actionLogin(payload: { username?: string; password?: string }) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  if (!username || !password) return { ok: false, error: 'Username dan password wajib diisi' };

  const attempts = await getLoginAttempts(username);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    return { ok: false, error: 'Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.' };
  }

  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('*').ilike('username', username).maybeSingle();

  if (!user || user.status !== 'aktif' || !(await verifyPassword(password, user.password_hash))) {
    await registerFailedLogin(username);
    return { ok: false, error: 'Username atau password salah' };
  }

  await clearLoginAttempts(username);
  try {
    await cleanExpiredSessions();
  } catch {
    /* tidak fatal jika gagal */
  }

  const token = await createSession(user);
  return {
    ok: true,
    token,
    user: { id: user.id, nama: user.nama, role: user.role, kelas_id: user.kelas_id },
  };
}

export async function actionLogout(token: string | null | undefined) {
  if (token) {
    const db = getSupabaseAdmin();
    await db.from('sessions').delete().eq('token', token);
  }
  return { ok: true };
}
