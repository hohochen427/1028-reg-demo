import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, authRequired, authSecret, sessionToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];
// /setup 是給還沒拿到密碼的學員看的部署教學，連同底下的截圖素材都不卡登入牆
const PUBLIC_PREFIXES = ['/setup'];

export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await sessionToken(process.env.ADMIN_PASSWORD ?? '', authSecret());

  if (cookie === expected) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 });
  }
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
