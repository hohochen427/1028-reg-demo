import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { LOCAL_USER, SESSION_COOKIE, authRequired, authSecret, verifySession } from './auth';
import type { SessionUser } from './types';

/** Route Handler 用：從 request 的 Cookie 取出目前登入的使用者；沒登入回傳 null */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  if (!authRequired()) return LOCAL_USER;
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value, authSecret());
}

/** Server Component（例如 layout）用 */
export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  if (!authRequired()) return LOCAL_USER;
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, authSecret());
}

/**
 * 管理端 API 的第二道防線：就算 middleware 被繞過，沒有 admin 身分也進不來。
 * 通過回傳使用者；沒通過回傳要直接 return 的 Response。
 */
export async function requireAdmin(req: NextRequest): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser(req);
  if (!user) return { response: NextResponse.json({ error: '尚未登入' }, { status: 401 }) };
  if (user.role !== 'admin') return { response: NextResponse.json({ error: '只有管理員可以使用這個功能' }, { status: 403 }) };
  return { user };
}
