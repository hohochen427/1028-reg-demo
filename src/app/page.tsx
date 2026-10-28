'use client';

import { useState } from 'react';
import type { AskResult } from '@/lib/types';

export default function HomePage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '查詢失敗');
      setResult(data as AskResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <section aria-labelledby="ask-heading" className="card">
        <h2 id="ask-heading">問問題</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="question">你的問題</label>
          <textarea
            id="question"
            name="question"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：退貨期限是幾天？"
          />
          <button type="submit" disabled={loading || !question.trim()}>
            {loading ? '查詢中…' : '送出'}
          </button>
        </form>
        <p className="hint">
          知識庫目前收錄 <code>data/docs/</code> 裡的範例文件。先執行 <code>npm run ingest -- --reset</code>
          建庫，再回來問問題。
        </p>
      </section>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {result && (
        <section aria-live="polite" className="result">
          <div className="card answer-card">
            <h2>回答</h2>
            <p className="answer-text">{result.answer}</p>
            {result.citations.length > 0 && (
              <ul className="citations">
                {result.citations.map((c) => (
                  <li key={c.marker}>
                    【資料 {c.marker}】{c.source}／{c.section}
                  </li>
                ))}
              </ul>
            )}
            <p className="meta">
              Embedding：{result.embeddingProvider}　LLM：{result.llmProvider}　儲存層：{result.storeKind}
              　耗時：{result.elapsedMs}ms
            </p>
            {result.warning && <p className="warning">提醒：{result.warning}</p>}
            {result.withheldCount > 0 && (
              <p className="warning">
                有 {result.withheldCount} 筆檢索結果標記「僅限本機」，因為目前用的是外部 LLM，
                已經不送進去。要改這個行為請到「設定」頁。
              </p>
            )}
          </div>

          <div className="card">
            <h2>檢索到的段落（Top {result.candidates.length}）</h2>
            <p className="hint">這是系統真正拿去交給模型的證據，不是模型憑空講的話。</p>
            <ol className="candidates">
              {result.candidates.map((c, i) => (
                <li key={c.id}>
                  <div className="candidate-head">
                    <span>
                      【資料 {i + 1}】{c.source}／{c.section}
                      {c.visibility === 'local_only' && (
                        <>
                          {' '}
                          <span className="badge lock">僅限本機</span>
                        </>
                      )}
                    </span>
                    <span className="score">相似度 {c.score.toFixed(3)}</span>
                  </div>
                  <p className="candidate-text">{c.text}</p>
                </li>
              ))}
            </ol>
            {result.candidates.length === 0 && <p>沒有找到任何相關段落。</p>}
          </div>
        </section>
      )}
    </div>
  );
}
