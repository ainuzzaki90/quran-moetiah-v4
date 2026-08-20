'use client';

import { useEffect, useState } from 'react';
import type { User } from './AppShell';
import { ROLE_LABELS } from '@/lib/menu';

export default function Topbar({
  user, onToggleSidebar, onLogout,
}: {
  user: User;
  onToggleSidebar: () => void;
  onLogout: () => void;
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mq_theme') : null;
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setDark(true);
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('mq_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('mq_theme', 'light');
    }
  }

  return (
    <div className="tf-topbar">
      <button className="tf-hamburger" onClick={onToggleSidebar} aria-label="Buka menu">☰</button>
      <div className="tf-user">
        <span>{user.nama} ({ROLE_LABELS[user.role]})</span>
        <button onClick={toggleTheme} aria-label="Ganti tema gelap/terang" title="Ganti tema">
          {dark ? '☀️' : '🌙'}
        </button>
        <button onClick={onLogout}>Keluar</button>
      </div>
    </div>
  );
}
