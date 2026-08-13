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

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
