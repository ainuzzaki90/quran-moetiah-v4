import { NextRequest } from 'next/server';
import { actionLogout } from '@/lib/auth';
import { getToken, jsonOk } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  const result = await actionLogout(getToken(req));
  return jsonOk(result);
}
