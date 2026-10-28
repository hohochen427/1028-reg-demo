# RAG-demo

一個最小可行版本（MVP）的 RAG 問答網站：問問題，系統找出最相關的段落，交給模型回答並附上引用來源；後台可以直接上傳文件（.md／.txt／.pdf／.docx）、從網址擷取內容、調整切片大小、刪除文件；設定頁可以自己貼 LLM 的 API Key（BYOK），也可以把特定文件標成「僅限本機」，問答時不會把那份資料的原文送到外部 API。

這不是教學用的完成品，是一個**故意留白**的起點——跑得起來、看得懂、改得動，接下來要加什麼功能，由你和學員一起決定、一起動手。帶學員上課用，照 [docs/CLASSROOM_CHECKLIST.md](docs/CLASSROOM_CHECKLIST.md) 的順序走一遍即可。

## 五分鐘跑起來（離線模式，不需要任何帳號）

```bash
npm install
cp .env.example .env          # 預設就是離線模式，不用改
npm run ingest -- --reset     # 建庫：讀 data/docs/ 裡的範例文件
npm run dev                   # 打開 http://localhost:3000
```

離線模式用本機的字元 n-gram 向量與抽取式回答，**不呼叫任何 API、不需要金鑰**。語意題（換句話問）在這個模式下會比較弱，這是離線模式的代價，不是 bug——想看真正的語意搜尋與生成，照 [docs/DEPLOY.md](docs/DEPLOY.md) 接上 Voyage 與 Claude。

## 這個流程在做什麼

```
Query → Embedding → Vector Search → Context → LLM → Answer ＋ Citation
```

整條流程只有一個進入點：`src/lib/pipeline.ts` 的 `ask()`。網頁送出問題、API route 收到之後直接呼叫這個函式，流程裡每一步都只對應一個檔案：

| 步驟 | 檔案 |
| --- | --- |
| 文件解析（.md／.txt／.pdf／.docx） | `src/lib/parseUpload.ts` |
| 文件切塊 | `src/lib/chunk.ts` |
| Embedding（向量化） | `src/lib/embedding.ts` |
| 向量儲存與搜尋 | `src/lib/store.ts` |
| Prompt 組裝與回答生成 | `src/lib/llm.ts` |
| 串起整條流程 | `src/lib/pipeline.ts` |
| 問答頁與 API | `src/app/page.tsx`、`src/app/api/ask/route.ts` |
| 後台上傳／管理頁與 API | `src/app/admin/page.tsx`、`src/app/api/admin/*` |
| 網址擷取 | `src/lib/htmlToText.ts`、`src/app/api/admin/fetch-url/route.ts` |
| BYOK／隱私設定頁與 API | `src/app/settings/page.tsx`、`src/app/api/admin/settings/route.ts` |
| 登入保護 | `src/middleware.ts`、`src/lib/auth.ts` |

## 後台管理（`/admin`）

打開 `/admin` 可以：

- 上傳多個 `.md`／`.txt`／`.pdf`／`.docx` 檔案，上傳時就能調整這次要用的切片大小（字元數）與重疊長度，不用改程式碼重跑指令。
- 貼一個網址，自動抓取網頁內容（JS 動態載入的頁面抓不到）加進知識庫。
- 上傳／擷取時可以勾選「僅限本機使用」，見下面「BYOK 與隱私設定」。
- 看目前知識庫裡有哪些文件、各自切了幾塊、可見範圍是什麼。
- 刪除某一份文件（連同它所有的切片）。

同一個檔名重複上傳會直接覆蓋舊的切片（docId 是檔名轉來的）。

**注意**：離線模式（`RAG_STORE=file`）的上傳內容存在本機 `.data/` 資料夾，只適合本機試跑。部署在 Vercel 這類無狀態環境時檔案系統不會保留，上傳功能必須先照下面「部署成正式網站」接上 `RAG_STORE=pg`（Neon）才能真的保存。

## BYOK 與隱私設定（`/settings`）

打開 `/settings` 可以：

- 不改 `.env`／Vercel 環境變數，直接在網頁貼自己的 LLM API Key。支援 Claude、Gemini，以及任何「OpenAI Chat Completions 相容」的端點（OpenAI、Groq、DeepSeek、Kimi、MiniMax、Grok 或其他，Base URL 可以自己填）。
- 選「不使用」會回到離線示範模式（抽取式回答，不呼叫任何 API）。
- 打開／關閉「允許把 local_only 的資料送到外部 API」，預設關閉。

**「僅限本機」（local_only）保護的是什麼**：上傳或網址擷取時勾選後，問答時只要檢索到的段落裡有一筆是 local_only，就不會把它的原文放進送給外部 LLM 的 Context，`/ask` 的回應會回報被排除了幾筆（`withheldCount`）。這一層只保護「送進 LLM 的原文」這一步——比 Embedding 外洩向量更嚴重的那條線。目前**沒有**做到「local_only 的內容連 Embedding 都強制走本地模型」：如果 `EMBEDDING_PROVIDER=voyage`，向量化那一步仍然會把文字送到 Voyage，這是已知限制，不是沒想到。

## 登入保護

預設沒有密碼保護（方便本機離線試跑）。要保護整個網站，在 `.env` 設定：

```
ADMIN_PASSWORD=你的密碼
AUTH_SECRET=另外一組隨機字串（選填，不填會退回用 ADMIN_PASSWORD 本身）
```

設定後除了 `/login` 以外的所有頁面與 API 都需要先登入。這是單一密碼保護整站，不是多使用者帳號系統——要做到「每個人有自己的知識庫」，見下方「接下來你可以加什麼」。

## 指令

| 指令 | 做什麼 |
| --- | --- |
| `npm run ingest -- --reset` | 清空並重新建庫（讀 `data/docs/*.md`，開發時的快速起手式；正式使用請用 `/admin` 上傳） |
| `npm run db:init` | 在 Neon 建立資料表與索引（離線模式不需要） |
| `npm run dev` / `npm run build` | 開發伺服器／正式建置 |
| `npm run typecheck` | TypeScript 型別檢查 |

## 放自己的文件

兩種方式都會建進同一個知識庫：

- **網頁上傳**（推薦）：打開 `/admin`，選檔案（.md／.txt／.pdf／.docx）、視需要調整切片大小，按上傳。
- **指令建庫**：把 Markdown 檔丟進 `data/docs/`，用 `# 標題` 當文件名稱、`## 小標題` 當章節，重新執行 `npm run ingest -- --reset`。這個路徑只認得 `data/docs/` 裡的 `.md`，適合開發時快速重建整個知識庫；範例文件在同一個資料夾，可以直接刪掉換成自己的。

## 部署成正式網站

離線模式只是起點，接上 Neon（資料庫）、Voyage AI（Embedding）、Claude API（回答）、部署到 Vercel 的完整步驟，見 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 接下來你可以加什麼

這個 MVP 刻意只做「先找，再答」的主線，沒有做的功能都是現成的練習題：

- **Hybrid Search**：只靠向量相似度找不到精確編號（像訂單編號、錯誤代碼），加一個關鍵字比對（例如 `pg_trgm` 或簡單的字面比對）跟向量搜尋合併分數。
- **Reranking**：Top-K 候選找回來後，候選的第一名不一定是最佳答案，可以再用一個更仔細的模型或規則重排。
- **Query Rewrite**：使用者接連問「海外訂單呢？」這種承接上一題的問法，直接查會找不到東西，先把問題補完整再檢索。
- **Metadata Filtering**：文件有新舊版本、不同部門時，依 `status`、`department` 這類欄位先篩選再檢索，避免找到已經失效的舊規定。
- **Evidence Check**：檢索到的段落主題對、但沒寫出問題要的那個數字時，相似度分數看不出來，可以讓模型自己先判斷「這些資料夠不夠回答」。
- **local_only 連 Embedding 都保護**：目前 local_only 只擋住送進 LLM 的原文，向量化還是照 `EMBEDDING_PROVIDER` 走。要做到「local_only 無條件走本地 Embedding」，要讓同一個資料庫裡能同時存在不同維度的向量，或乾脆開兩張表分流。
- **多使用者帳號**：現在是單一密碼保護整站、所有人共用同一個知識庫；要做到每個人有自己的知識庫，需要使用者資料表、註冊／登入流程，並把 `doc_id`／`chunks` 都加上 `user_id` 隔離。
- **權限控管**：不同身分看得到的文件不同（例如主管薪資表只有主管能查），要在檢索層就擋掉，不能只靠 Prompt 提醒模型。
- **評估集**：準備一份「問題 ＋ 正確答案來源」的題庫，每次改動 Pipeline 都重新跑一次，量化回答有沒有變好或變差。

每一項都可以直接從 `src/lib/pipeline.ts` 開始改——在 `ask()` 裡找到該插入的那一步，加一個函式呼叫就是最小的起手式。

## 無障礙

介面以 WCAG 2.1 AA 為目標：語意化標記、跳至主要內容連結、表單控制項有對應 `<label>`、鍵盤可完整操作且焦點外框明顯、文字對比至少 4.5:1（深淺色模式各自調校）、回答區為 `aria-live` 區域。
