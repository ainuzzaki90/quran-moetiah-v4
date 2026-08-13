import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from './auth';

export function jsonOk(data: Record<string, any> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function getToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Membungkus handler route supaya error (termasuk AuthError dan Error biasa
// yang dilempar dari action) otomatis diubah jadi { ok:false, error } —
// persis perilaku try/catch di doPost() Router.gs versi lama.
export function withErrorHandling(fn: (req: NextRequest, ctx: any) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (err: any) {
      const status = err instanceof AuthError ? 401 : 400;
      return jsonError(err.message || 'Terjadi kesalahan pada server', status);
    }
  };
}
