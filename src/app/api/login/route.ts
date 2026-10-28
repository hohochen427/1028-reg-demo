import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, authSecret, sessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const password = typeof (body as { password?: unknown })?.password === 'string'
    ? (body as { password: string }).password
    : '';

  const correct = process.env.ADMIN_PASSWORD ?? '';
  if (!correct || password !== correct) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
  }

  const token = await sessionToken(correct, authSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
