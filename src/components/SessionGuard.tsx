'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getRemember, getSessionExp, setSessionExp, setStoredUser, setToken, getStoredUser } from '@/lib/api-client';
import type { User } from './AppShell';

const PERINGATAN_MS = 5 * 60 * 1000;   // banner muncul saat sisa sesi < 5 menit
const PING_AKTIF_MS = 5 * 60 * 1000;   // saat aktif, perbarui sesi paling sering tiap 5 menit
const CEK_MS = 30 * 1000;

/**
 * - Menjaga sesi tetap hidup selama pengguna aktif (ping berkala; server memperpanjang sesi).
 * - Banner peringatan sebelum sesi habis.
 * - Jendela "masukkan password lagi" saat sesi habis (permintaan yang gagal diulang otomatis, isian form tidak hilang).
 */
export default function SessionGuard({ user, onSwitchUser, onExpiredLogout }: {
  user: User;
  onSwitchUser: (token: string, u: User) => void;
  onExpiredLogout: () => void;
}) {
  const [sisa, setSisa] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const doneRef = useRef<((ok: boolean) => void) | null>(null);
  const lastAct = useRef(Date.now());
  const lastPing = useRef(0);
  const pinging = useRef(false);

  const ping = useCallback(async () => {
    if (pinging.current) return;
    pinging.current = true;
    try {
      const r = await api.get('/auth/ping');
      setSessionExp(r.expires_at);
      lastPing.current = Date.now();
    } catch { /* 401 ditangani jendela login ulang; error jaringan diabaikan */ }
    finally { pinging.current = false; }
  }, []);

  // aktivitas pengguna
  useEffect(() => {
    const tandai = () => { lastAct.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    evs.forEach((e) => window.addEventListener(e, tandai, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, tandai));
  }, []);

  // pemeriksaan berkala
  useEffect(() => {
    if (!getSessionExp()) ping(); // sesi lama tanpa catatan waktu habis
    const cek = () => {
      const exp = getSessionExp();
      const now = Date.now();
      if (exp) {
        const s = exp - now;
        setSisa(s < PERINGATAN_MS ? Math.max(s, 0) : null);
        if (s <= 0) { ping(); return; } // memicu 401 -> jendela login ulang
      }
      const aktif = now - lastAct.current < 2 * 60 * 1000;
      if (aktif && now - lastPing.current > PING_AKTIF_MS) ping();
    };
    cek();
    const t = setInterval(cek, CEK_MS);
    const vis = () => { if (document.visibilityState === 'visible') cek(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ping]);

  // permintaan login ulang dari api-client
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      const done = (e as CustomEvent).detail?.done as (ok: boolean) => void;
      doneRef.current = done;
      setModal(true);
    };
    window.addEventListener('mq-relogin', h);
    return () => window.removeEventListener('mq-relogin', h);
  }, []);

  const tutup = (ok: boolean) => { setModal(false); doneRef.current?.(ok); doneRef.current = null; };

  return (
    <>
      {sisa !== null && !modal && (
        <div className="tf-sess-bar" role="status">
          <span>{sisa > 0 ? `Sesi akan berakhir dalam ${Math.max(1, Math.ceil(sisa / 60000))} menit.` : 'Sesi berakhir.'}</span>
          <button className="tf-btn-sm tf-btn" onClick={() => { lastPing.current = 0; ping().then(() => setSisa(null)); }}>Perpanjang</button>
        </div>
      )}
      {modal && (
        <ReloginModal
          user={user}
          onOk={(token, u) => {
            if (u.id !== user.id) { tutup(false); onSwitchUser(token, u); }
            else tutup(true);
          }}
          onKeluar={() => { tutup(false); onExpiredLogout(); }}
        />
      )}
    </>
  );
}

function ReloginModal({ user, onOk, onKeluar }: { user: User; onOk: (token: string, u: User) => void; onKeluar: () => void }) {
  const stored = getStoredUser();
  const [username, setUsername] = useState<string>(stored?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const adaUsername = !!stored?.username;

  async function masuk() {
    setError('');
    if (!username.trim() || !password) { setError('Username dan password wajib diisi'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username: username.trim(), password, remember: getRemember() });
      setToken(res.token);
      setStoredUser(res.user);
      setSessionExp(res.expires_at);
      onOk(res.token, res.user);
    } catch (e: any) {
      setError(e.message || 'Gagal masuk');
    } finally { setLoading(false); }
  }

  return (
    <div className="tf-modal-bg" role="dialog" aria-modal="true" aria-labelledby="tf-relogin-judul">
      <div className="tf-modal" style={{ maxWidth: 400 }}>
        <h3 id="tf-relogin-judul">Sesi Anda sudah berakhir</h3>
        <p style={{ margin: '0 0 14px', fontSize: 14 }}>
          Halo <b>{user.nama}</b>, masukkan password untuk melanjutkan. Halaman dan isian Anda tidak akan hilang.
        </p>
        <div className="tf-field">
          <label htmlFor="tf-relogin-user">Username</label>
          <input id="tf-relogin-user" value={username} readOnly={adaUsername} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="tf-field">
          <label htmlFor="tf-relogin-pass">Password</label>
          <input id="tf-relogin-pass" type="password" autoFocus={adaUsername} autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && masuk()} />
        </div>
        {error && <div className="tf-error" style={{ marginTop: 0 }}>{error}</div>}
        <div className="tf-modal-actions">
          <button className="tf-btn-secondary" onClick={onKeluar} disabled={loading}>Keluar</button>
          <button className="tf-btn" onClick={masuk} disabled={loading}>{loading ? 'Memproses...' : 'Lanjutkan'}</button>
        </div>
      </div>
    </div>
  );
}
