import fs from 'node:fs';
import path from 'node:path';

/** 給 CLI 腳本用的極簡 .env 載入器（Next.js 自己會載入 .env，不需要這個） */
export function loadEnv(file = '.env'): void {
  const target = path.join(process.cwd(), file);
  if (!fs.existsSync(target)) return;
  for (const line of fs.readFileSync(target, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
