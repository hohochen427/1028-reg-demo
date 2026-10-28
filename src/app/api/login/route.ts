import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, authSecret, signSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getStore } from '@/lib/store';
import type { UserRecord } from '@/lib/types';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// 用來在「查無此帳號」時也跑一次 scrypt，讓回應時間不洩漏 email 是否存在
const DUMMY_HASH_PROMISE = hashPassword('dummy-password-for-timing');

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  if (!adminPassword || !adminEmail) {
    return NextResponse.json(
      { error: '伺服器還沒設定 ADMIN_EMAIL 與 ADMIN_PASSWORD，沒有人能登入。請先在環境變數設定第一個管理員。' },
      { status: 500 },
    );
  }
  if (!email || !password) {
    return NextResponse.json({ error: '請輸入 email 與密碼' }, { status: 400 });
  }

  try {
    const store = getStore();
    let user: UserRecord | null = await store.getUserByEmail(email);

    // 第一個管理員：users 表裡還沒有這個 email，而且輸入的正好是 ADMIN_EMAIL ＋ ADMIN_PASSWORD，就用它建帳號。
    // 帳號建好之後，登入一律以資料庫裡的密碼雜湊為準，環境變數不再是後門。
    if (!user && safeEqual(email, adminEmail) && safeEqual(password, adminPassword)) {
      const created = await store.createUser({
        email: adminEmail,
        name: '管理員',
        passwordHash: await hashPassword(adminPassword),
        role: 'admin',
        groups: [],
      });
      user = await store.getUserByEmail(created.email);
    }

    const valid = user
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPassword(password, await DUMMY_HASH_PROMISE), false);
    if (!user || !valid) {
      return NextResponse.json({ error: 'email 或密碼錯誤' }, { status: 401 });
    }

    const token = await signSession({ id: user.id, role: user.role, groups: user.groups }, authSecret());
    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: `登入時發生錯誤：${err instanceof Error ? err.message : String(err)}（若剛升級，請先在 Neon 執行 db/migrate-users.sql）` },
      { status: 500 },
    );
  }
}
