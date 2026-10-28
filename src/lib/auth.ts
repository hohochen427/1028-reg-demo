import type { Role, SessionUser } from './types';

export const SESSION_COOKIE = 'rag_demo_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// 這個檔案會被 Edge Middleware 引用，所以只用 Web Crypto，不碰 node:crypto。

/** 是否有設定 ADMIN_PASSWORD；沒設定時整站不要求登入（本機離線試跑用） */
export function authRequired(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** 用來簽 session 的密鑰；建議一定要另外設定 AUTH_SECRET */
export function authSecret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'rag-demo';
}

/** 沒開登入保護（本機離線試跑）時，所有人視為這個管理員 */
export const LOCAL_USER: SessionUser = { id: 'local', role: 'admin', groups: [] };

interface SessionPayload extends SessionUser {
  /** 到期時間（Unix 秒） */
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** 簽出 session Token：base64url(payload).base64url(HMAC-SHA256)，payload 帶使用者 id、role、groups 與到期時間 */
export async function signSession(user: SessionUser, secret: string): Promise<string> {
  const payload: SessionPayload = {
    id: user.id,
    role: user.role,
    groups: user.groups,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** 驗章（常數時間比對）並檢查到期；任何一步不對都回傳 null */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig, ...rest] = token.split('.');
  if (!body || !sig || rest.length > 0) return null;
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sigBytes, new TextEncoder().encode(body));
  if (!ok) return null;

  const raw = fromBase64Url(body);
  if (!raw) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(raw)) as Partial<SessionPayload>;
    const role: Role | null = p.role === 'admin' || p.role === 'member' ? p.role : null;
    if (typeof p.id !== 'string' || !role || !Array.isArray(p.groups) || typeof p.exp !== 'number') return null;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: p.id, role, groups: p.groups.map(String) };
  } catch {
    return null;
  }
}
