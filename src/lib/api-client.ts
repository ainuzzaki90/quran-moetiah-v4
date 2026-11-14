'use client';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mq_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('mq_token', token);
  else localStorage.removeItem('mq_token');
}

export function getStoredUser(): any {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('mq_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem('mq_user', JSON.stringify(user));
  else localStorage.removeItem('mq_user');
}

// ---- metadata sesi (waktu habis & opsi "Ingat saya") ----
export function getSessionExp(): number | null {
  if (typeof window === 'undefined') return null;
  const v = Number(localStorage.getItem('mq_exp'));
  return v > 0 ? v : null;
}
export function setSessionExp(iso: string | number | null) {
  if (typeof window === 'undefined') return;
  const t = iso ? new Date(iso).getTime() : 0;
  if (t > 0) localStorage.setItem('mq_exp', String(t)); else localStorage.removeItem('mq_exp');
}
export function getRemember(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('mq_remember') === '1';
}
export function setRemember(v: boolean) {
  if (typeof window === 'undefined') return;
  if (v) localStorage.setItem('mq_remember', '1'); else localStorage.removeItem('mq_remember');
}

// ---- login ulang saat sesi habis: permintaan yang gagal (401) ditahan, jendela login tampil, lalu permintaan diulang ----
let reloginPromise: Promise<boolean> | null = null;
function requestRelogin(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!reloginPromise) {
    reloginPromise = new Promise<boolean>((resolve) => {
      let selesai = false;
      const done = (ok: boolean) => { if (!selesai) { selesai = true; resolve(ok); } };
      const tidakDitangani = window.dispatchEvent(new CustomEvent('mq-relogin', { detail: { done }, cancelable: true }));
      if (tidakDitangani) done(false); // tidak ada yang menangani (mis. di layar login)
    }).finally(() => { reloginPromise = null; });
  }
  return reloginPromise;
}

async function request(method: string, path: string, body?: any, sudahUlang = false): Promise<any> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token && !sudahUlang && !path.startsWith('/auth/')) {
    const ok = await requestRelogin();
    if (ok) return request(method, path, body, true);
    throw new Error('Sesi Anda sudah berakhir. Silakan masuk kembali.');
  }
  const data = await res.json().catch(() => ({ ok: false, error: 'Respons server tidak valid' }));
  if (!data.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: any) => request('POST', path, body),
  put: (path: string, body?: any) => request('PUT', path, body),
  del: (path: string, body?: any) => request('DELETE', path, body),
};
