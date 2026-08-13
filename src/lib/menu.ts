export type Role = 'admin' | 'penyimak' | 'santri' | 'tamu';

export const MENU: { key: string; label: string; roles: Role[] }[] = [
  { key: 'dashboard', label: 'Dashboard', roles: ['admin', 'penyimak', 'santri', 'tamu'] },
  { key: 'setoran', label: 'Setoran', roles: ['admin', 'penyimak'] },
  { key: 'presensi', label: 'Presensi', roles: ['admin', 'penyimak'] },
  { key: 'santri', label: 'Data Siswa', roles: ['admin', 'penyimak', 'tamu'] },
  { key: 'kelas', label: 'Data Kelas', roles: ['admin'] },
  { key: 'statistik', label: 'Statistik', roles: ['admin', 'penyimak', 'santri', 'tamu'] },
  { key: 'progress', label: 'Progress Siswa', roles: ['admin', 'penyimak', 'santri', 'tamu'] },
  { key: 'rekap', label: 'Rekap & Rapor', roles: ['admin', 'penyimak', 'tamu'] },
  { key: 'mushaf', label: 'Mushaf Digital', roles: ['admin', 'penyimak', 'santri', 'tamu'] },
  { key: 'users', label: 'Pengguna', roles: ['admin'] },
];
