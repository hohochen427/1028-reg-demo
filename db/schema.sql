-- RAG-demo schema（Neon Postgres ＋ pgvector）
--
-- 注意：vector(256) 的維度必須等於 .env 的 EMBEDDING_DIM。
-- 改用 Voyage（voyage-3，1024 維）時，請把下面的 256 改成 1024，
-- 並重新執行 npm run db:init 與 npm run ingest:reset。

CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS chunks;

CREATE TABLE chunks (
  id          TEXT PRIMARY KEY,
  doc_id      TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  embedding   vector(1024) NOT NULL,
  source      TEXT        NOT NULL,
  section     TEXT        NOT NULL DEFAULT '',
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  -- local_only：絕不送到外部 LLM（除非在 /settings 明確打開開關）
  visibility  TEXT        NOT NULL DEFAULT 'public',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

-- 執行期設定（BYOK：供應商、API Key、隱私開關），只有一列，id 固定是 'default'
CREATE TABLE IF NOT EXISTS settings (
  id         TEXT PRIMARY KEY,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
