import { NextRequest, NextResponse } from 'next/server';
import { normalizeGroups } from '@/lib/access';
import { hashPassword } from '@/lib/password';
import { requireAdmin } from '@/lib/session';
import { EmailExistsError, getStore } from '@/lib/store';

export const runtime = 'nodejs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    return NextResponse.json({ users: await getStore().listUsers() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '讀取使用者失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : null;

  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: '請輸入有效的 email' }, { status: 400 });
  if (!name) return NextResponse.json({ error: '請輸入名稱' }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `初始密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` }, { status: 400 });
  }
  if (!role) return NextResponse.json({ error: '角色必須是 admin 或 member' }, { status: 400 });

  try {
    const user = await getStore().createUser({
      email,
      name,
      passwordHash: await hashPassword(password),
      role,
      groups: normalizeGroups(body.groups),
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof EmailExistsError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : '新增使用者失敗' }, { status: 500 });
  }
}
