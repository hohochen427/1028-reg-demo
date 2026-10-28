import fs from 'node:fs/promises';
import path from 'node:path';
import type { RuntimeSettings, ScoredChunk, StoredChunk } from './types';
import { DEFAULT_SETTINGS } from './types';
import { cosineSimilarity } from './embedding';
import { env, storeKind } from './config';

export interface Store {
  readonly kind: 'file' | 'pg';
  reset(): Promise<void>;
  insert(chunks: StoredChunk[]): Promise<void>;
  count(): Promise<number>;
  list(limit: number, offset: number): Promise<Omit<StoredChunk, 'embedding'>[]>;
  vectorSearch(vector: number[], k: number): Promise<ScoredChunk[]>;
  keywordSearch(terms: string[], k: number): Promise<ScoredChunk[]>;
  deleteByDocId(docId: string): Promise<void>;
  getSettings(): Promise<RuntimeSettings>;
  setSettings(settings: RuntimeSettings): Promise<void>;
  close(): Promise<void>;
}

function strip(c: StoredChunk): Omit<StoredChunk, 'embedding'> {
  const { embedding, ...rest } = c;
  void embedding;
  return rest;
}

// ──────────────────────────── file store（離線示範） ────────────────────────────

const DATA_FILE = path.join(process.cwd(), '.data', 'chunks.json');
const SETTINGS_FILE = path.join(process.cwd(), '.data', 'settings.json');

class FileStore implements Store {
  readonly kind = 'file' as const;
  private cache: StoredChunk[] | null = null;
  private cachedMtimeMs = 0;

  /**
   * 依檔案修改時間決定要不要重讀，不然開發伺服器會一直抱著舊的 Chunk：
   * 另一個終端機重新建庫了，畫面卻完全沒變。
   */
  private async load(): Promise<StoredChunk[]> {
    let mtimeMs = 0;
    try {
      mtimeMs = (await fs.stat(DATA_FILE)).mtimeMs;
    } catch {
      this.cache = [];
      this.cachedMtimeMs = 0;
      return this.cache;
    }
    if (this.cache && mtimeMs === this.cachedMtimeMs) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) as StoredChunk[];
    } catch {
      this.cache = [];
    }
    this.cachedMtimeMs = mtimeMs;
    return this.cache;
  }

  private async save(chunks: StoredChunk[]): Promise<void> {
    try {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(chunks), 'utf8');
    } catch (err) {
      throw new Error(
        '這個主機的檔案系統是唯讀的，RAG_STORE=file（離線模式）沒辦法寫入。' +
          '部署在 Vercel 這類無狀態環境要先接上 Neon，把 RAG_STORE 改成 pg（見 docs/DEPLOY.md）。' +
          `（原始錯誤：${err instanceof Error ? err.message : err}）`,
      );
    }
    this.cache = chunks;
    try {
      this.cachedMtimeMs = (await fs.stat(DATA_FILE)).mtimeMs;
    } catch {
      this.cachedMtimeMs = 0;
    }
  }

  async reset(): Promise<void> {
    await this.save([]);
  }

  async insert(chunks: StoredChunk[]): Promise<void> {
    const all = await this.load();
    const byId = new Map(all.map((c) => [c.id, c]));
    for (const c of chunks) byId.set(c.id, c);
    await this.save(Array.from(byId.values()));
  }

  async count(): Promise<number> {
    return (await this.load()).length;
  }

  async list(limit: number, offset: number): Promise<Omit<StoredChunk, 'embedding'>[]> {
    const all = await this.load();
    return all.slice(offset, offset + limit).map(strip);
  }

  async vectorSearch(vector: number[], k: number): Promise<ScoredChunk[]> {
    const all = await this.load();
    return all
      .map((c) => ({ ...strip(c), score: cosineSimilarity(vector, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async keywordSearch(terms: string[], k: number): Promise<ScoredChunk[]> {
    const needles = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
    if (needles.length === 0) return [];
    const all = await this.load();
    return all
      .map((c) => {
        const section = c.section.toLowerCase();
        const text = c.text.toLowerCase();
        // 一筆一筆比對 section 和 text，命中幾個關鍵字就得幾分
        const score = needles.filter((n) => section.includes(n) || text.includes(n)).length;
        return { ...strip(c), score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async deleteByDocId(docId: string): Promise<void> {
    const all = await this.load();
    await this.save(all.filter((c) => c.docId !== docId));
  }

  async getSettings(): Promise<RuntimeSettings> {
    try {
      const raw = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
      return { ...DEFAULT_SETTINGS, ...raw };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async setSettings(settings: RuntimeSettings): Promise<void> {
    try {
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings), 'utf8');
    } catch (err) {
      throw new Error(
        '這個主機的檔案系統是唯讀的，RAG_STORE=file（離線模式）沒辦法寫入設定。' +
          '部署在 Vercel 這類無狀態環境要先接上 Neon，把 RAG_STORE 改成 pg（見 docs/DEPLOY.md）。' +
          `（原始錯誤：${err instanceof Error ? err.message : err}）`,
      );
    }
  }

  async close(): Promise<void> {
    this.cache = null;
    this.cachedMtimeMs = 0;
  }
}

// ──────────────────────────── pg store（Neon ＋ pgvector） ────────────────────────────

type PgRow = Record<string, unknown>;

function rowToScored(row: PgRow): ScoredChunk {
  return {
    id: String(row.id),
    docId: String(row.doc_id),
    text: String(row.text),
    source: String(row.source),
    section: String(row.section ?? ''),
    chunkIndex: Number(row.chunk_index ?? 0),
    visibility: row.visibility === 'local_only' ? 'local_only' : 'public',
    score: Number(row.score ?? 0),
  };
}

class PgStore implements Store {
  readonly kind = 'pg' as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private poolPromise: Promise<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async pool(): Promise<any> {
    if (!this.poolPromise) {
      this.poolPromise = (async () => {
        const connectionString = env('DATABASE_URL');
        if (!connectionString) throw new Error('RAG_STORE=pg 但缺少 DATABASE_URL');
        const { Pool } = await import('pg');
        return new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
      })();
    }
    return this.poolPromise;
  }

  async reset(): Promise<void> {
    const pool = await this.pool();
    await pool.query('TRUNCATE chunks');
  }

  async insert(chunks: StoredChunk[]): Promise<void> {
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const c of chunks) {
        await client.query(
          `INSERT INTO chunks (id, doc_id, text, embedding, source, section, chunk_index, visibility)
           VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET
             text = EXCLUDED.text, embedding = EXCLUDED.embedding, visibility = EXCLUDED.visibility`,
          [c.id, c.docId, c.text, JSON.stringify(c.embedding), c.source, c.section, c.chunkIndex, c.visibility],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async count(): Promise<number> {
    const pool = await this.pool();
    const res = await pool.query('SELECT count(*)::int AS n FROM chunks');
    return res.rows[0]?.n ?? 0;
  }

  async list(limit: number, offset: number): Promise<Omit<StoredChunk, 'embedding'>[]> {
    const pool = await this.pool();
    const res = await pool.query(
      'SELECT id, doc_id, text, source, section, chunk_index, visibility FROM chunks ORDER BY doc_id, chunk_index LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return res.rows.map((r: PgRow) => ({
      id: String(r.id),
      docId: String(r.doc_id),
      text: String(r.text),
      source: String(r.source),
      section: String(r.section ?? ''),
      chunkIndex: Number(r.chunk_index ?? 0),
      visibility: r.visibility === 'local_only' ? 'local_only' : 'public',
    }));
  }

  async vectorSearch(vector: number[], k: number): Promise<ScoredChunk[]> {
    const pool = await this.pool();
    const res = await pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS score
         FROM chunks
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
      [JSON.stringify(vector), k],
    );
    return res.rows.map((r: PgRow) => rowToScored(r));
  }

  async keywordSearch(terms: string[], k: number): Promise<ScoredChunk[]> {
    const patterns = terms
      .filter((t) => t.length > 0)
      // 跳脫 LIKE 的萬用字元，讓關鍵字只做字面比對
      .map((t) => `%${t.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
    if (patterns.length === 0) return [];
    const pool = await this.pool();
    const res = await pool.query(
      `SELECT *, 1 AS score
         FROM chunks
        WHERE text ILIKE ANY($1::text[]) OR section ILIKE ANY($1::text[])
        LIMIT $2`,
      [patterns, k],
    );
    return res.rows.map((r: PgRow) => rowToScored(r));
  }

  async deleteByDocId(docId: string): Promise<void> {
    const pool = await this.pool();
    await pool.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);
  }

  async getSettings(): Promise<RuntimeSettings> {
    const pool = await this.pool();
    const res = await pool.query('SELECT data FROM settings WHERE id = $1', ['default']);
    if (res.rows.length === 0) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...res.rows[0].data };
  }

  async setSettings(settings: RuntimeSettings): Promise<void> {
    const pool = await this.pool();
    await pool.query(
      `INSERT INTO settings (id, data) VALUES ('default', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [JSON.stringify(settings)],
    );
  }

  async close(): Promise<void> {
    if (!this.poolPromise) return;
    const pool = await this.poolPromise;
    await pool.end();
    this.poolPromise = null;
  }
}

let singleton: Store | null = null;

export function getStore(): Store {
  if (!singleton) singleton = storeKind() === 'pg' ? new PgStore() : new FileStore();
  return singleton;
}
