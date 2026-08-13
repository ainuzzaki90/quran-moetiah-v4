'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from './AppShell';

export default function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!username || !password) { setError('Username dan password wajib diisi'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      onLogin(res.token, res.user);
    } catch (e: any) {
      setError(e.message || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="tahfiz-app">
      <div className="tf-right-col">
        <div className="tf-login-wrap">
          <div className="tf-login-box">
            <img src="/assets/logo.png" alt="Logo SMP Islam Moetiah" className="tf-login-logo" />
            <h2>SMP Islam Moetiah</h2>
            <p className="tf-app-name">Moetiah Quran App</p>
            <div className="tf-field">
              <label htmlFor="tf-login-username">Username</label>
              <input
                id="tf-login-username"
                type="text"
                placeholder="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              />
            </div>
            <div className="tf-field">
              <label htmlFor="tf-login-password">Password</label>
              <input
                id="tf-login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              />
            </div>
            <button className="tf-btn" onClick={submit} disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
            {error && <div className="tf-error">{error}</div>}
          </div>
        </div>
        <footer className="tf-footer">© {new Date().getFullYear()} SMP Islam Moetiah — dikembangkan oleh Abdal Ainuz Zaki, B.A.</footer>
      </div>
    </div>
  );
}
