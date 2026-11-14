import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from './supabase';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 jam sejak aktivitas terakhir (sesi diperpanjang otomatis selama aktif)
const REMEMBER_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // opsi "Ingat saya": 30 hari sejak aktivitas terakhir
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
export async function createSession(user: { id: number; role: string; kelas_id: number | null }, remember = false) {
  const db = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DURATION_MS : SESSION_DURATION_MS)).toISOString();
  const { data, error } = await db
    .from('sessions')
    .insert({ user_id: user.id, role: user.role, kelas_id: user.kelas_id, expires_at: expiresAt })
    .select('token')
    .single();
  if (error) throw new Error(error.message);
  return { token: data.token as string, expires_at: expiresAt };
}

// Cache sesi singkat di memori server (mengurangi 1 query database per request).
// Logout menghapus cache; masa berlaku cache hanya 30 detik.
const SESSION_CACHE_MS = 30 * 1000;
const sessionCache = new Map<string, { user: SessionUser; expires: number; cachedAt: number }>();

/**
 * Sesi diperpanjang otomatis (sliding): setiap ada aktivitas, masa berlaku didorong lagi
 * ke 8 jam (atau 30 hari untuk sesi "Ingat saya") dari sekarang. Pembaruan database dibatasi
 * agar tidak dilakukan di setiap request. Sesi "Ingat saya" dikenali dari sisa waktu > 8 jam.
 */
async function perpanjang(token: string, expires: number, now: number): Promise<number> {
  const panjang = expires - now > SESSION_DURATION_MS;
  const target = now + (panjang ? REMEMBER_DURATION_MS : SESSION_DURATION_MS);
  const ambang = panjang ? 60 * 60 * 1000 : 10 * 60 * 1000;
  if (target - expires < ambang) return expires;
  try {
    await getSupabaseAdmin().from('sessions').update({ expires_at: new Date(target).toISOString() }).eq('token', token);
    return target;
  } catch {
    return expires; // tidak fatal
  }
}

/** Waktu habis (ms) sesi dari cache setelah getSessionUser/requireAuth dipanggil. */
export function sessionExpiresAt(token: string): number | null {
  return sessionCache.get(token)?.expires ?? null;
}

export async function getSessionUser(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const hit = sessionCache.get(token);
  const now = Date.now();
  if (hit && now - hit.cachedAt < SESSION_CACHE_MS && hit.expires > now) {
    hit.expires = await perpanjang(token, hit.expires, now);
    return hit.user;
  }

  const db = getSupabaseAdmin();
  const { data } = await db.from('sessions').select('*').eq('token', token).maybeSingle();
  if (!data) { sessionCache.delete(token); return null; }
  let expires = new Date(data.expires_at).getTime();
  if (expires < now) { sessionCache.delete(token); return null; }
  expires = await perpanjang(token, expires, now);
  const user: SessionUser = {
    token: data.token,
    user_id: data.user_id,
    role: data.role,
    kelas_id: data.kelas_id,
  };
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(token, { user, expires, cachedAt: now });
  return user;
}

/** Mengeluarkan semua sesi seorang pengguna (dipakai saat akun dinonaktifkan, peran/password diubah, atau dihapus). */
export async function revokeUserSessions(userId: number | string) {
  const db = getSupabaseAdmin();
  const { data } = await db.from('sessions').select('token').eq('user_id', userId);
  (data || []).forEach((r: any) => sessionCache.delete(r.token));
  await db.from('sessions').delete().eq('user_id', userId);
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
export async function actionLogin(payload: { username?: string; password?: string; remember?: boolean }) {
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

  const { token, expires_at } = await createSession(user, payload.remember === true);
  return {
    ok: true,
    token,
    expires_at,
    user: { id: user.id, username: user.username, nama: user.nama, role: user.role, kelas_id: user.kelas_id },
  };
}

export async function actionLogout(token: string | null | undefined) {
  if (token) {
    sessionCache.delete(token);
    const db = getSupabaseAdmin();
    await db.from('sessions').delete().eq('token', token);
  }
  return { ok: true };
}
