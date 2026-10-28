export const SESSION_COOKIE = 'rag_demo_session';

/** 用 Web Crypto（Node 與 Edge Middleware 都能跑）算出登入 Token，不把密碼明文放進 Cookie */
export async function sessionToken(password: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 是否有設定 ADMIN_PASSWORD；沒設定時整站不要求登入（本機離線試跑用） */
export function authRequired(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function authSecret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'rag-demo';
}
