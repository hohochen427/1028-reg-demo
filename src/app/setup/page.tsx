import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '部署教學｜RAG-demo',
  description: '從申請帳號到看見自己的網站回答問題，一步一步做。',
};

interface Step {
  n: number;
  title: string;
  body: React.ReactNode;
  img?: { src: string; alt: string; caption: string };
}

const steps: Step[] = [
  {
    n: 1,
    title: '拿到程式碼',
    body: (
      <>
        <p>二選一：</p>
        <ul>
          <li>
            有 git：<code>git clone https://github.com/Joanna8521/Rag-Demo.git</code>
          </li>
          <li>沒有 git：直接下載講師給的 <code>RAG-demo.zip</code>，解壓縮到你喜歡的資料夾</li>
        </ul>
        <p>接著打開終端機，進到那個資料夾，依序跑：</p>
        <pre>
          <code>{`npm install
cp .env.example .env`}</code>
        </pre>
      </>
    ),
  },
  {
    n: 2,
    title: '申請 Neon（資料庫）',
    body: (
      <>
        <p>
          到 <a href="https://neon.tech" target="_blank" rel="noreferrer">neon.tech</a> 按右上角
          <strong> Sign up</strong>，用 Google 帳號登入最快，不用填信用卡。建立一個新專案後，畫面上會有
          <strong> Connection string</strong>，切換選 <strong>Pooled connection</strong>，按複製——這串就是等一下要用的
          <code>DATABASE_URL</code>。
        </p>
      </>
    ),
    img: { src: '/setup/neon-home.png', alt: 'Neon 官網首頁，右上角有 Sign up 按鈕', caption: 'neon.tech 首頁，右上角 Sign up' },
  },
  {
    n: 3,
    title: '申請 Voyage AI（Embedding，語意搜尋用）',
    body: (
      <p>
        到 <a href="https://www.voyageai.com" target="_blank" rel="noreferrer">voyageai.com</a> 註冊、申請 API Key，
        這組是 <code>VOYAGE_API_KEY</code>。
      </p>
    ),
    img: { src: '/setup/voyage-home.png', alt: 'Voyage AI 官網首頁', caption: 'voyageai.com 首頁' },
  },
  {
    n: 4,
    title: '申請 Claude（Anthropic，負責回答）',
    body: (
      <p>
        到 <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> 用
        Google 帳號或 Email 註冊，申請 API Key，這組是 <code>ANTHROPIC_API_KEY</code>。
      </p>
    ),
    img: { src: '/setup/anthropic-console.png', alt: 'Claude Console 登入頁', caption: 'console.anthropic.com 登入頁' },
  },
  {
    n: 5,
    title: '本機填 .env、建庫',
    body: (
      <>
        <p>
          打開資料夾裡的 <code>.env</code>，把上面三步拿到的值填進去：
        </p>
        <pre>
          <code>{`RAG_STORE=pg
DATABASE_URL=<Neon 的連線字串>
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=<Voyage key>
EMBEDDING_DIM=1024
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=<Claude key>`}</code>
        </pre>
        <p>存檔後回到終端機：</p>
        <pre>
          <code>{`npm run db:init
npm run ingest -- --reset
npm run dev`}</code>
        </pre>
        <p>打開 <code>http://localhost:3000</code> 先問一題，確認本機這邊沒問題再往下。</p>
      </>
    ),
  },
  {
    n: 6,
    title: '部署到 Vercel',
    body: (
      <>
        <p>
          到 <a href="https://vercel.com/new" target="_blank" rel="noreferrer">vercel.com/new</a>，用 GitHub 登入，
          選擇 <strong>Import Git Repository</strong>，找到你剛才 clone／fork 的那個 repo（Next.js 專案會自動偵測，
          Build 設定不用改）。
        </p>
      </>
    ),
    img: { src: '/setup/vercel-new.png', alt: 'Vercel New Project 頁面', caption: 'vercel.com/new：Import Git Repository' },
  },
  {
    n: 7,
    title: '在 Vercel 貼環境變數',
    body: (
      <>
        <p>
          匯入專案時（或之後到專案的 <strong>Settings → Environment Variables</strong>）把 <code>.env</code>
          裡的那七組值，加上 <code>ADMIN_PASSWORD</code>（自己取一組網站密碼）一起貼上去，全部套用到
          <strong> Production</strong>。
        </p>
        <p className="hint">
          這一頁在你自己的 Vercel 帳號裡，需要先登入才看得到，這裡沒辦法放截圖，照上面文字操作就好：
          每一列是一組 Key 跟 Value，填完按 Save。
        </p>
        <p>
          存完按 <strong>Deploy</strong>（第一次部署）或到 <strong>Deployments</strong> 頁按
          <strong> Redeploy</strong>（已經部署過、只是改了環境變數）。改環境變數不會自動套用到舊的部署，一定要重新部署一次。
        </p>
      </>
    ),
  },
  {
    n: 8,
    title: '驗收',
    body: (
      <>
        <p>部署完打開你的網址：</p>
        <ol>
          <li>用剛才設定的 <code>ADMIN_PASSWORD</code> 登入</li>
          <li>到「問答」頁問一題，確認 <code>llmProvider</code> 顯示 <code>claude</code>（不是 <code>local</code>）</li>
          <li>到「後台管理」上傳自己的文件，重新整理後文件還在，代表真的存進 Neon 了</li>
        </ol>
      </>
    ),
    img: { src: '/setup/app-home.png', alt: '部署完成後的問答頁畫面', caption: '完成後長這樣：問答頁' },
  },
];

export default function SetupPage() {
  return (
    <div className="page setup">
      <section className="card">
        <h2>部署教學</h2>
        <p>
          從零開始，把這個 RAG 知識庫部署成你自己的網站。全程免費額度就夠，不用填信用卡。跟著下面八步做，
          卡住的地方截圖問你的講師。
        </p>
      </section>

      {steps.map((s) => (
        <section key={s.n} className="card step">
          <h2>
            <span className="step-n">{s.n}</span>
            {s.title}
          </h2>
          <div className="step-body">{s.body}</div>
          {s.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <figure className="step-figure">
              <img src={s.img.src} alt={s.img.alt} loading="lazy" />
              <figcaption>{s.img.caption}</figcaption>
            </figure>
          )}
        </section>
      ))}

      <section className="card">
        <h2>後台管理與設定頁的樣子</h2>
        <p className="hint">部署完成、登入之後，「後台管理」跟「設定」頁實際畫面：</p>
        <div className="setup-gallery">
          <figure className="step-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/setup/app-admin.png" alt="後台管理頁面，可上傳文件、從網址擷取、管理知識庫" loading="lazy" />
            <figcaption>後台管理：上傳文件、從網址擷取、刪除文件</figcaption>
          </figure>
          <figure className="step-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/setup/app-settings.png" alt="設定頁面，可貼 API Key 與隱私開關" loading="lazy" />
            <figcaption>設定頁：BYOK、local_only 隱私開關</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
