import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from './load-env';

loadEnv();

/** 在 Neon 上建立資料表與索引（RAG_STORE=file 的離線模式不需要執行） */
async function main() {
  if (process.env.RAG_STORE !== 'pg') {
    console.log('RAG_STORE 不是 pg，離線示範模式不需要建立資料表。');
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('缺少 DATABASE_URL');

  const dim = Number(process.env.EMBEDDING_DIM ?? '256') || 256;
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const sql = (await fs.readFile(schemaPath, 'utf8')).replace(/vector\(256\)/g, `vector(${dim})`);

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(sql);
    console.log(`資料表 chunks 已建立，向量維度 ${dim}。`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
