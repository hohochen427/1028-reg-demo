import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

// 只能在 Node runtime 使用（Route Handler / script），不能被 middleware 引用。

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 };

function derive(password: string, salt: Buffer, keyLength: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password.normalize('NFKC'), salt, keyLength, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** 用 crypto.scrypt 加隨機鹽雜湊。格式：scrypt$N$r$p$鹽(base64)$雜湊(base64)，參數跟著存，之後調高成本也驗得了舊密碼 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length === 0) return false;
  try {
    const actual = await derive(password, salt, expected.length, { N, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
