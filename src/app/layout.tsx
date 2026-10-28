import type { Metadata } from 'next';
import './globals.css';
import NavActions from './nav-actions';
import { authRequired } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'RAG-demo｜知識庫問答 MVP',
  description: '最小可行版本的 RAG 問答網站：問一個問題，看見檢索到的段落與帶引用的回答。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showLogout = authRequired();
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main">
          跳到主要內容
        </a>
        <header className="site">
          <div className="inner">
            <h1>RAG-demo</h1>
            <p>最小可行版本：問一個問題 → 找到最相關的段落 → 交給模型回答，並附上引用來源。</p>
            <nav aria-label="主選單" className="main-nav">
              <ul>
                <li>
                  <a href="/">問答</a>
                </li>
                <li>
                  <a href="/admin">後台管理</a>
                </li>
                <li>
                  <a href="/settings">設定</a>
                </li>
                <li>
                  <a href="/setup">部署教學</a>
                </li>
              </ul>
              {showLogout && <NavActions />}
            </nav>
          </div>
        </header>
        <main id="main" className="layout">
          {children}
        </main>
        <footer className="site">
          <p>
            這是教學用起點，不是完成品。想加 Hybrid Search、Reranking、多使用者帳號、細緻權限控管都歡迎直接改
            <code>src/lib/pipeline.ts</code>，詳見 README 的「接下來你可以加什麼」。
          </p>
        </footer>
      </body>
    </html>
  );
}
