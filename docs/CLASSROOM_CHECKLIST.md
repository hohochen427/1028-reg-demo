# 上課現場 Checklist

帶學員從「離線示範」走到「自己部署出一個真的能用的網站」，照這個順序做，每一步都當場看得到結果。

> 部署站本身也有一份圖文教學：**`/setup`**（例如 `https://rag-demo-mu.vercel.app/setup`），不用密碼就看得到，
> 把下面第二到第四階段整理成八個步驟、附實際截圖。學員可以自己開著那頁跟著做，這份 checklist 給你掌握節奏、
> 當卡關時的對照表用。

## 時間表（標準版，3 小時，含兩次休息）

| 時間 | 內容 | 對應階段 |
| --- | --- | --- |
| 0:00–0:15 | 開場：RAG 在解決什麼問題（先找，再答），用一句「公司規定改了，AI 怎麼知道」當切入點 | — |
| 0:15–0:30 | 學員各自跑離線模式：`npm install` → `ingest` → `dev`，問範例文件裡的問題 | 第一階段 |
| 0:30–0:45 | 講解：打開 `/admin` 看切片、`/settings` 看供應商切換，對照剛剛看到的結果講 Parsing／Chunking／Embedding／Retrieval 這幾個詞 | — |
| 0:45–0:55 | 休息 | — |
| 0:55–1:15 | 學員自己開 `/setup`，各自申請 Neon／Voyage／Claude（這步最容易卡，抓寬一點） | 第二階段 |
| 1:15–1:35 | 填 `.env`、`db:init`、重新 `ingest`，問同一題比較離線 vs. 真正語意搜尋的差別——這是整堂課最好的「啊哈」時刻 | 第三階段 |
| 1:35–2:05 | 部署到 Vercel、貼環境變數、Redeploy、拿到自己的網址 | 第四階段 |
| 2:05–2:15 | 休息 | — |
| 2:15–2:45 | 延伸練習：全班一起寫 Hybrid Search，時間夠再加 Query Rewrite 或 Evidence Check | 第五階段 |
| 2:45–3:00 | 總結、Q&A、留下聯絡方式讓卡關的人課後問 | — |

### 壓縮版（2 小時）

把開場講解（0:30–0:45）縮到 10 分鐘、延伸練習只留 Hybrid Search 不加碼、Q&A 縮到 5 分鐘，大約可以壓到 2 小時整。
**風險**：申請 API Key 這段（0:55–1:15）常常是全班進度的瓶頸，壓縮版仍建議保留完整 20 分鐘，不要從這段擠時間。

### 兩個提醒

1. **`/setup` 那段讓學員自己看著做，你巡場排除問題**，不要照稿念——這段本來就是等待（申請帳號、等信箱驗證），人盯著螢幕比念稿有用。
2. **準備一組你自己的備用 Key**，萬一有學員卡在信用卡驗證或額度問題，可以先借他用，不要讓一個人卡關拖累全班進度。

## 上課前（講師準備）

- [ ] 自己先走過一次全部流程，確認 Neon／Voyage／Claude 的申請頁面沒有改版
- [ ] 準備一份不重要的測試文件（.md／.txt），不要用真的機密資料示範 local_only
- [ ] 跟學員說清楚：Neon／Voyage／Claude 都有免費額度，不用填信用卡（如果中途改成要收費，當場提醒）
- [ ] 準備好 GitHub 帳號登入方式（學員要 Fork 或自己建一份 repo）

## 第一階段：離線跑起來（不用任何帳號，5 分鐘）

- [ ] `git clone` 自己的 repo（或 Fork 這份 `RAG-demo`）
- [ ] `npm install`
- [ ] `cp .env.example .env`（什麼都不用改）
- [ ] `npm run ingest -- --reset`，看終端機印出「建庫完成，共 N 塊 Chunk」
- [ ] `npm run dev`，打開 `http://localhost:3000`，問一題範例文件裡的問題
- [ ] 帶學員看 `/admin` 上傳自己的文件、`/settings` 頁面長什麼樣（這時候選「不使用」也能跑）

## 第二階段：申請三組 API Key（大約 10 分鐘，可直接照 `/setup` 自己做）

- [ ] **Neon**：[neon.tech](https://neon.tech) 註冊 → 建專案 → 複製 **Pooled connection string**（`DATABASE_URL`）
- [ ] **Voyage AI**：[voyageai.com](https://www.voyageai.com) 註冊 → 申請 API Key（`VOYAGE_API_KEY`）
- [ ] **Claude（Anthropic）**：[console.anthropic.com](https://console.anthropic.com) 註冊 → 申請 API Key（`ANTHROPIC_API_KEY`）
- [ ] 提醒學員：這三組值先存到記事本，等一下本機 `.env` 跟 Vercel 都要貼同樣的值

## 第三階段：本機接上真正的資料庫與模型（大約 10 分鐘）

- [ ] 編輯 `.env`，填入：
  ```
  RAG_STORE=pg
  DATABASE_URL=<Neon 的連線字串>
  EMBEDDING_PROVIDER=voyage
  VOYAGE_API_KEY=<Voyage key>
  EMBEDDING_DIM=1024
  LLM_PROVIDER=claude
  ANTHROPIC_API_KEY=<Claude key>
  ```
- [ ] `npm run db:init`，看到「資料表 chunks 已建立，向量維度 1024。」
- [ ] `npm run ingest -- --reset`，重新建庫
- [ ] `npm run dev`，問同一題，比較跟離線模式的回答有什麼不一樣（這是最好的教學時刻：語意搜尋 vs. 字面比對）

## 第四階段：部署到 Vercel（大約 10 分鐘）

- [ ] 把 `.env` 的七組值對應貼到 Vercel 專案的 **Settings → Environment Variables**
- [ ] 额外設定 `ADMIN_PASSWORD`（一組密碼，保護整個網站）
- [ ] 到 **Deployments** 頁按 **Redeploy**（改環境變數不會自動套用到舊版本）
- [ ] 打開部署好的網址，用剛設的密碼登入，確認：
  - [ ] `/` 問答正常回答，`llmProvider` 顯示 `claude`
  - [ ] `/admin` 可以上傳文件、文件列表看得到
  - [ ] `/settings` 可以存取（這時候留空，用 Vercel 的環境變數即可）

## 第五階段：延伸練習（約 30 分鐘，全班一起加一項功能）

順序不是隨便排的，是照「學員在離線模式已經親眼撞過的痛點」排的——先解決他們剛剛自己卡住的地方，比憑空介紹一個功能有說服力。

### 先讓大家看一下現成的（5 分鐘，不用寫程式）

- [ ] `/admin` 試著標一份文件「僅限本機」，問跟它相關的問題，看 `withheldCount` 有沒有變成 1
- [ ] `/settings` 貼一組不同供應商的 Key（例如 Groq 的免費額度），比較不同模型的回答風格
- [ ] `/admin` 用「從網址擷取」抓一篇網頁文章進知識庫

### 全班一起現場寫（挑 1 項，約 20–25 分鐘）

- [ ] **Hybrid Search（優先）**：離線模式問精確代碼（例如 `ERR-PAY-202`）答得出來，但換句話問的語意題答不準；接上 Voyage 之後換個角度再撞一次牆（語意詞找不到精確編號），馬上有「這就是我剛剛卡住的地方」的既視感。改法：在 `src/lib/store.ts` 的 `vectorSearch` 旁邊加一個 `keywordSearch`（簡單字面比對或 `ILIKE`），在 `src/lib/pipeline.ts` 合併兩邊分數排序。

### 時間夠，或學員自己想多做（挑 1 項）

- [ ] **Query Rewrite**：連續問兩題，第二題用「那海外呢？」這種承接上一句的問法，直接查會找不到東西；改法是把上一輪問題也丟給 LLM，先請它補完問題再檢索。概念好懂、程式碼量不大。
- [ ] **Evidence Check**：讓模型自己判斷「這些資料夠不夠回答」，對應常見的「主題對但答案沒寫」。要多包一次 LLM 呼叫，回答會變慢，demo 時間抓寬一點。

### 不排進這次流程，列成回去自己挑一項的作業

`Metadata Filtering`（要改資料庫 schema，範圍較大）、`Reranking`、`local_only 連 Embedding 都保護`、`多使用者帳號`、`權限控管`、`評估集`——這幾項工程量都偏大，直接沿用 README「接下來你可以加什麼」那份清單，請學員自己挑一項帶回去做。

**提醒自己**：貪心塞三四項、結果誰都沒做完，不如確保每個人至少完整走過一次「改程式碼 → 重跑 → 看到結果變好」的循環。

## 常見卡關

| 狀況 | 先檢查 |
| --- | --- |
| `npm run db:init` 說「不是 pg」 | `.env` 的 `RAG_STORE` 還是 `file`，沒存檔或打錯 |
| 本機問答都說「資料不足」 | 忘記 `npm run ingest -- --reset`，或 `.env` 的 Key 貼錯 |
| Vercel 上傳失敗說「唯讀」 | Vercel 的 `RAG_STORE` 還不是 `pg`，環境變數沒貼對或沒 Redeploy |
| 問答一直是離線示範回答 | `/settings` 裡選了某個供應商但沒填 Key，或 `.env`／Vercel 的 `LLM_PROVIDER` 不是 `claude` |
| 換了 Embedding 供應商後查不到東西 | 向量維度不一致，要重跑 `npm run db:init` 跟 `npm run ingest -- --reset` |

更細的部署步驟與除錯見 [DEPLOY.md](DEPLOY.md)，給學員自己照著做的圖文版在部署站的 `/setup`。
