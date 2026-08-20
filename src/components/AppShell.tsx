'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, getStoredUser, getToken, setStoredUser, setToken } from '@/lib/api-client';
import { MENU, Role } from '@/lib/menu';
import Login from './Login';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import DashboardView from './views/Dashboard';
import SantriView from './views/Santri';
import KelasView from './views/Kelas';
import SetoranView from './views/Setoran';
import PresensiView from './views/Presensi';
import StatistikView from './views/Statistik';
import ProgressView from './views/Progress';
import RekapView from './views/Rekap';
import MushafView from './views/Mushaf';
import UsersView from './views/Users';

export type User = { id: number; nama: string; role: Role; kelas_id: number | null };

export default function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  // Di layar lebar (desktop/tablet >=768px) sidebar tampil default terbuka;
  // di layar sempit (HP) default tertutup (mode overlay). Nilai ini juga yang
  // dipakai untuk tombol hamburger buka/tutup sidebar secara dinamis.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    const token = getToken();
    if (stored && token) setUser(stored);
    setChecking(false);

    const mq = window.matchMedia('(min-width: 768px)');
    const applyMatch = () => {
      setIsDesktop(mq.matches);
      setSidebarOpen(mq.matches); // desktop: terbuka default, mobile: tertutup default
    };
    applyMatch();
    mq.addEventListener('change', applyMatch);
    return () => mq.removeEventListener('change', applyMatch);
  }, []);

  const handleLogin = useCallback((token: string, u: User) => {
    setToken(token);
    setStoredUser(u);
    setUser(u);
    setView('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* abaikan */ }
    setToken(null);
    setStoredUser(null);
    setUser(null);
  }, []);

  if (checking) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const allowedMenu = MENU.filter((m) => m.roles.includes(user.role));
  if (!allowedMenu.find((m) => m.key === view)) {
    // Jika view saat ini tidak diizinkan untuk role user, jatuhkan ke dashboard.
    if (view !== 'dashboard') setView('dashboard');
  }

  return (
    <div id="tahfiz-app">
      <div className={`tf-sidebar-overlay ${sidebarOpen ? 'tf-open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menu={allowedMenu}
        activeView={view}
        onSelect={(k) => { setView(k); if (!isDesktop) setSidebarOpen(false); }}
      />
      <div className="tf-right-col">
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen((v) => !v)} onLogout={handleLogout} />
        <div className="tf-content">
          {view === 'dashboard' && <DashboardView user={user} />}
          {view === 'santri' && <SantriView user={user} />}
          {view === 'kelas' && <KelasView user={user} />}
          {view === 'setoran' && <SetoranView user={user} />}
          {view === 'presensi' && <PresensiView user={user} />}
          {view === 'statistik' && <StatistikView user={user} />}
          {view === 'progress' && <ProgressView user={user} />}
          {view === 'rekap' && <RekapView user={user} />}
          {view === 'mushaf' && <MushafView />}
          {view === 'users' && <UsersView />}
        </div>
        <footer className="tf-footer">© {new Date().getFullYear()} SMP Islam Moetiah — dikembangkan oleh Abdal Ainuz Zaki, B.A.</footer>
      </div>
    </div>
  );
}
