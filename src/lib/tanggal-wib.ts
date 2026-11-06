/** Utilitas tanggal berbasis WIB (UTC+7) -- server Vercel berjalan di UTC. Semua string 'YYYY-MM-DD'. */
export function hariIniWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
export function tambahHari(tgl: string, n: number): string {
  const d = new Date(tgl + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Senin pada minggu yang memuat tanggal tsb. */
export function seninMinggu(tgl: string): string {
  const d = new Date(tgl + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Senin=0
  return tambahHari(tgl, -dow);
}
export function awalBulan(tgl: string): string { return tgl.slice(0, 7) + '-01'; }
export function awalBulanLalu(tgl: string): string {
  const d = new Date(awalBulan(tgl) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}
