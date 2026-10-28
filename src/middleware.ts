import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, authRequired, authSecret, verifySession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];
// /setup 是給還沒拿到密碼的學員看的部署教學，連同底下的截圖素材都不卡登入牆
const PUBLIC_PREFIXES = ['/setup'];
// 只有 role 是 admin 的人能進：後台管理、設定頁、以及它們用的 API
const ADMIN_PREFIXES = ['/admin', '/settings', '/api/admin'];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => isUnder(pathname, p)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, authSecret());

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '尚未登入' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.role !== 'admin' && ADMIN_PREFIXES.some((p) => isUnder(pathname, p))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '只有管理員可以使用這個功能' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
