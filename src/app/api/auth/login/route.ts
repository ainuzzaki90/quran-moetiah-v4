import { NextRequest, NextResponse } from 'next/server';
import { actionLogin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const result = await actionLogin(payload);
  return NextResponse.json(result);
}
