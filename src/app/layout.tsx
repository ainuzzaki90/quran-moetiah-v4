import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Moetiah Quran App — SMP Islam Moetiah",
  description: "Aplikasi manajemen setoran, presensi, dan rapor tahfidz Al-Qur'an untuk SMP Islam Moetiah.",
  manifest: '/manifest.json',
  icons: {
    icon: '/assets/logo.png',
    apple: '/assets/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#14315c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
