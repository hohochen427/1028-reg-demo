# 部署成正式網站

離線模式只適合自己試跑。要讓學員「部署出一個真的能用的網站」，照下面三步接上真正的資料庫、Embedding 與 LLM。

## 1. Neon（資料庫）

1. 到 [neon.tech](https://neon.tech) 建立一個免費專案。
2. 在 SQL Editor 執行一次 `CREATE EXTENSION IF NOT EXISTS vector;`（或讓 `npm run db:init` 幫你做）。
3. 複製 Connection string（選 **Pooled connection**），填進 `.env` 的 `DATABASE_URL`。
4. 把 `.env` 的 `RAG_STORE` 改成 `pg`。
5. 執行 `npm run db:init` 建立 `chunks` 資料表。

## 2. Voyage AI（Embedding）

1. 到 [voyageai.com](https://www.voyageai.com) 申請 API Key。
2. 填進 `.env` 的 `VOYAGE_API_KEY`，把 `EMBEDDING_PROVIDER` 改成 `voyage`。
3. 把 `EMBEDDING_DIM` 改成 `1024`（voyage-3 的向量維度），**連同 `db/schema.sql` 的 `vector(256)` 也要改成 `vector(1024)`**，重跑一次 `npm run db:init`。
4. 執行 `npm run ingest -- --reset` 用新的 Embedding 重新建庫（舊維度的向量不能混用）。

## 3. Claude API（回答）

1. 到 [console.anthropic.com](https://console.anthropic.com) 申請 API Key。
2. 填進 `.env` 的 `ANTHROPIC_API_KEY`，把 `LLM_PROVIDER` 改成 `claude`。

## 4. 登入密碼（建議一定要設）

正式網站公開在網路上，不設密碼等於任何人都能上傳文件、問問題、刪掉別人的知識庫。在 `.env` 設定：

```
ADMIN_PASSWORD=一組不容易猜到的密碼
AUTH_SECRET=另外一組隨機字串
```

## 5. 部署到 Vercel

1. 把這個 repo push 到你自己的 GitHub 帳號（或直接用現在這個）。
2. 到 [vercel.com/new](https://vercel.com/new) 匯入這個 repo。
3. 在 Vercel 的 Environment Variables 貼上 `.env` 裡的每一項：`RAG_STORE`、`DATABASE_URL`、`EMBEDDING_PROVIDER`、`VOYAGE_API_KEY`、`EMBEDDING_DIM`、`LLM_PROVIDER`、`ANTHROPIC_API_KEY`、`ADMIN_PASSWORD`、`AUTH_SECRET`。
4. 按 Deploy。**改了 Environment Variables 之後要手動 Redeploy 才會生效**——Vercel 不會自動套用新的環境變數到舊的部署。
5. 部署完成後，打開 `/admin` 直接用網頁上傳文件建庫；也可以在本機跑 `npm run ingest -- --reset` 用 `data/docs/` 裡的範例文件先墊個底。

## 6. BYOK（選用，不想用環境變數管金鑰的話）

接上 Neon 之後，也可以不填 `LLM_PROVIDER`／`ANTHROPIC_API_KEY` 這兩個環境變數，改成部署完打開 `/settings` 網頁直接貼 Key，支援 Claude、Gemini 跟任何 OpenAI 相容端點（OpenAI、Groq、DeepSeek、Kimi、MiniMax、Grok）。網頁貼的設定優先於環境變數。

## 常見問題

- **網站打開是空的／回答都說資料不足**：還沒建庫。打開 `/admin` 上傳至少一份文件，或在本機跑 `npm run ingest -- --reset`。
- **`/admin` 上傳成功，但重新整理後文件不見了**：`RAG_STORE` 還是 `file`。離線模式的上傳內容存在本機 `.data/`，Vercel 這類無狀態環境留不住檔案，必須照上面第 1 步接上 Neon（`RAG_STORE=pg`）。
- **換了 Embedding 模型後查不到東西**：向量維度不一樣就不能比對，記得照上面第 2 步重建資料表與重新建庫。
- **想放自己的文件**：`/admin` 直接上傳最方便，也可以貼網址直接擷取；要用指令批次建庫，把 Markdown 檔丟進 `data/docs/`，`# 標題` 當文件名稱、`## 小標題` 當章節，重新 `npm run ingest -- --reset` 即可。
- **上傳 PDF／Word 失敗**：掃描版 PDF（圖片沒有文字層）解析不出文字，需要先用 OCR 工具轉成有文字層的 PDF 或直接存成 `.txt`。
- **已經部署過、現在升級到有 `/settings` 與 local_only 的版本**：`chunks` 資料表多了一欄 `visibility`，`npm run db:init` 會整個重建 `chunks`（原本的資料會被清空，`settings` 表不會動），重建完要重新上傳／`ingest` 一次。
