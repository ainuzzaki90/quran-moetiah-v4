import { NextRequest } from 'next/server';
import { requireAuth, sessionExpiresAt } from '@/lib/auth';
import { getToken, jsonOk, withErrorHandling } from '@/lib/api-helpers';

// Dipanggil peramban secara berkala saat pengguna aktif: memperpanjang sesi (sliding) dan
// mengembalikan waktu habis sesi terbaru.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const token = getToken(req);
  await requireAuth(token);
  const exp = token ? sessionExpiresAt(token) : null;
  return jsonOk({ expires_at: exp ? new Date(exp).toISOString() : null });
});
