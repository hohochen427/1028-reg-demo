-- 升級腳本：加入「多使用者帳號」與「知識庫權限」
--
-- 用法：貼到 Neon Console 的 SQL Editor 執行即可。
-- 可以重複執行，而且不會刪除或改動任何既有的文件與切片：
--   * 只用 CREATE TABLE IF NOT EXISTS 與 ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   * 既有切片的 allowed_groups 會自動補成空陣列（＝所有登入者都看得到）

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  groups        TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 可見群組：空陣列代表所有登入者都看得到；admin 永遠看得到
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS allowed_groups TEXT[] NOT NULL DEFAULT '{}';
