import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PublicUser, RuntimeSettings, ScoredChunk, StoredChunk, UserRecord, Viewer } from './types';
import { DEFAULT_SETTINGS } from './types';
import { cosineSimilarity } from './embedding';
import { canView } from './access';
import { env, storeKind } from './config';

export interface Store {
  readonly kind: 'file' | 'pg';
  reset(): Promise<void>;
  insert(chunks: StoredChunk[]): Promise<void>;
  count(): Promise<number>;
  list(limit: number, offset: number): Promise<Omit<StoredChunk, 'embedding'>[]>;
  /** 權限在檢索層擋：viewer 看不到的 Chunk 根本不會被撈出來，不靠 Prompt 叫模型別講 */
  vectorSearch(vector: number[], k: number, viewer: Viewer): Promise<ScoredChunk[]>;
  keywordSearch(terms: string[], k: number, viewer: Viewer): Promise<ScoredChunk[]>;
  deleteByDocId(docId: string): Promise<void>;
  getSettings(): Promise<RuntimeSettings>;
  setSettings(settings: RuntimeSettings): Promise<void>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(user: Omit<UserRecord, 'id'>): Promise<PublicUser>;
  listUsers(): Promise<PublicUser[]>;
  close(): Promise<void>;
}

/** email 已經有人用了 */
export class EmailExistsError extends Error {
  constructor() {
    super('這個 email 已經有帳號了');
    this.name = 'EmailExistsError';
  }
}

function strip(c: StoredChunk): Omit<StoredChunk, 'embedding'> {
  const { embedding, ...rest } = c;
  void embedding;
  return rest;
}

function toPublicUser(u: UserRecord): PublicUser {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
}

// ──────────────────────────── file store（離線示範） ────────────────────────────

const DATA_FILE = path.join(process.cwd(), '.data', 'chunks.json');
const SETTINGS_FILE = path.join(process.cwd(), '.data', 'settings.json');
const USERS_FILE = path.join(process.cwd(), '.data', 'users.json');

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
      const parsed = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) as StoredChunk[];
      // 舊版建的 Chunk 沒有 allowedGroups，補成空陣列（＝所有登入者可見）
      this.cache = parsed.map((c) => ({ ...c, allowedGroups: Array.isArray(c.allowedGroups) ? c.allowedGroups : [] }));
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

  async vectorSearch(vector: number[], k: number, viewer: Viewer): Promise<ScoredChunk[]> {
    const all = (await this.load()).filter((c) => canView(c.allowedGroups, viewer));
    return all
      .map((c) => ({ ...strip(c), score: cosineSimilarity(vector, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async keywordSearch(terms: string[], k: number, viewer: Viewer): Promise<ScoredChunk[]> {
    const needles = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
    if (needles.length === 0) return [];
    const all = (await this.load()).filter((c) => canView(c.allowedGroups, viewer));
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

  private async loadUsers(): Promise<UserRecord[]> {
    try {
      return JSON.parse(await fs.readFile(USERS_FILE, 'utf8')) as UserRecord[];
    } catch {
      return [];
    }
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const target = email.trim().toLowerCase();
    return (await this.loadUsers()).find((u) => u.email === target) ?? null;
  }

  async createUser(user: Omit<UserRecord, 'id'>): Promise<PublicUser> {
    const users = await this.loadUsers();
    const email = user.email.trim().toLowerCase();
    if (users.some((u) => u.email === email)) throw new EmailExistsError();
    const record: UserRecord = { ...user, email, id: randomUUID() };
    try {
      await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
      await fs.writeFile(USERS_FILE, JSON.stringify([...users, record]), 'utf8');
    } catch (err) {
      throw new Error(
        '這個主機的檔案系統是唯讀的，RAG_STORE=file（離線模式）沒辦法寫入使用者。' +
          '部署在 Vercel 這類無狀態環境要先接上 Neon，把 RAG_STORE 改成 pg（見 docs/DEPLOY.md）。' +
          `（原始錯誤：${err instanceof Error ? err.message : err}）`,
      );
    }
    return toPublicUser(record);
  }

  async listUsers(): Promise<PublicUser[]> {
    return (await this.loadUsers()).map(toPublicUser);
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
    allowedGroups: rowGroups(row.allowed_groups),
    score: Number(row.score ?? 0),
  };
}

function rowGroups(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function rowToUser(r: PgRow): UserRecord {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    passwordHash: String(r.password_hash),
    role: r.role === 'admin' ? 'admin' : 'member',
    groups: rowGroups(r.groups),
  };
}

/**
 * 檢索層的權限條件（對應 canView）：
 *   allowed_groups 為空，或與使用者群組有交集，或使用者是 admin。
 * $roleIsAdmin、$groups 是參數位置，呼叫端負責帶入。
 */
function visibilityWhere(roleParam: string, groupsParam: string): string {
  return `(cardinality(allowed_groups) = 0 OR allowed_groups && ${groupsParam}::text[] OR ${roleParam}::boolean)`;
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
          `INSERT INTO chunks (id, doc_id, text, embedding, source, section, chunk_index, visibility, allowed_groups)
           VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9::text[])
           ON CONFLICT (id) DO UPDATE SET
             text = EXCLUDED.text, embedding = EXCLUDED.embedding, visibility = EXCLUDED.visibility,
             allowed_groups = EXCLUDED.allowed_groups`,
          [c.id, c.docId, c.text, JSON.stringify(c.embedding), c.source, c.section, c.chunkIndex, c.visibility, c.allowedGroups],
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
      'SELECT id, doc_id, text, source, section, chunk_index, visibility, allowed_groups FROM chunks ORDER BY doc_id, chunk_index LIMIT $1 OFFSET $2',
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
      allowedGroups: rowGroups(r.allowed_groups),
    }));
  }

  async vectorSearch(vector: number[], k: number, viewer: Viewer): Promise<ScoredChunk[]> {
    const pool = await this.pool();
    const res = await pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS score
         FROM chunks
        WHERE ${visibilityWhere('$3', '$4')}
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
      [JSON.stringify(vector), k, viewer.role === 'admin', viewer.groups],
    );
    return res.rows.map((r: PgRow) => rowToScored(r));
  }

  async keywordSearch(terms: string[], k: number, viewer: Viewer): Promise<ScoredChunk[]> {
    const patterns = terms
      .filter((t) => t.length > 0)
      // 跳脫 LIKE 的萬用字元，讓關鍵字只做字面比對
      .map((t) => `%${t.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
    if (patterns.length === 0) return [];
    const pool = await this.pool();
    const res = await pool.query(
      `SELECT *, 1 AS score
         FROM chunks
        WHERE (text ILIKE ANY($1::text[]) OR section ILIKE ANY($1::text[]))
          AND ${visibilityWhere('$3', '$4')}
        LIMIT $2`,
      [patterns, k, viewer.role === 'admin', viewer.groups],
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

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const pool = await this.pool();
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    return res.rows.length > 0 ? rowToUser(res.rows[0]) : null;
  }

  async createUser(user: Omit<UserRecord, 'id'>): Promise<PublicUser> {
    const pool = await this.pool();
    try {
      const res = await pool.query(
        `INSERT INTO users (id, email, name, password_hash, role, groups)
         VALUES ($1,$2,$3,$4,$5,$6::text[])
         RETURNING *`,
        [randomUUID(), user.email.trim().toLowerCase(), user.name, user.passwordHash, user.role, user.groups],
      );
      return toPublicUser(rowToUser(res.rows[0]));
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new EmailExistsError();
      throw err;
    }
  }

  async listUsers(): Promise<PublicUser[]> {
    const pool = await this.pool();
    const res = await pool.query('SELECT * FROM users ORDER BY created_at, email');
    return res.rows.map((r: PgRow) => toPublicUser(rowToUser(r)));
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
