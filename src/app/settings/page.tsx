'use client';

import { useEffect, useState } from 'react';
import type { LlmProviderKind } from '@/lib/types';

const BASE_URL_PRESETS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  kimi: 'https://api.moonshot.cn/v1',
  minimax: 'https://api.minimax.chat/v1',
  grok: 'https://api.x.ai/v1',
};

const MODEL_PLACEHOLDER: Record<LlmProviderKind, string> = {
  none: '',
  claude: 'claude-sonnet-5-5',
  gemini: 'gemini-2.0-flash',
  openai_compatible: '依供應商而定，例如 gpt-4o-mini、llama-3.3-70b-versatile',
};

export default function SettingsPage() {
  const [provider, setProvider] = useState<LlmProviderKind>('none');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [allowExternalForLocalOnly, setAllowExternalForLocalOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider);
        setBaseUrl(data.baseUrl);
        setModel(data.model);
        setAllowExternalForLocalOnly(data.allowExternalForLocalOnly);
        setApiKeySet(data.apiKeySet);
        setApiKeyMasked(data.apiKeyMasked);
      }
      setLoaded(true);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl, model, allowExternalForLocalOnly }),
      });
      if (!res.ok) throw new Error('儲存失敗');
      setApiKey('');
      setMessage('已儲存。');
      const refreshed = await (await fetch('/api/admin/settings')).json();
      setApiKeySet(refreshed.apiKeySet);
      setApiKeyMasked(refreshed.apiKeyMasked);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="page">載入中…</div>;

  return (
    <div className="page">
      <section aria-labelledby="settings-heading" className="card">
        <h2 id="settings-heading">問答設定</h2>
        <p className="hint">
          在這裡貼自己的 API Key（BYOK），不用改 Vercel 的環境變數。留空「不使用」則回到離線示範模式。
        </p>
        <form onSubmit={handleSave}>
          <label htmlFor="provider">LLM 供應商</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as LlmProviderKind)}
          >
            <option value="none">不使用（離線示範回答）</option>
            <option value="claude">Claude（Anthropic）</option>
            <option value="gemini">Gemini（Google）</option>
            <option value="openai_compatible">
              OpenAI 相容端點（OpenAI／Groq／DeepSeek／Kimi／MiniMax／Grok／其他）
            </option>
          </select>

          {provider === 'openai_compatible' && (
            <>
              <label htmlFor="baseUrlPreset">常見端點（選了會自動填進下面的 Base URL，可以再自行修改）</label>
              <select
                id="baseUrlPreset"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) setBaseUrl(BASE_URL_PRESETS[e.target.value]);
                }}
              >
                <option value="">— 選一個或自己填 —</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="deepseek">DeepSeek</option>
                <option value="kimi">Kimi（Moonshot）</option>
                <option value="minimax">MiniMax</option>
                <option value="grok">Grok（xAI）</option>
              </select>

              <label htmlFor="baseUrl">Base URL</label>
              <input
                id="baseUrl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </>
          )}

          {provider !== 'none' && (
            <>
              <label htmlFor="model">模型名稱</label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={MODEL_PLACEHOLDER[provider]}
              />

              <label htmlFor="apiKey">
                API Key {apiKeySet && <span className="hint">（已設定：{apiKeyMasked}，留空代表不更動）</span>}
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={apiKeySet ? '留空＝沿用現有金鑰' : '貼上你的 API Key'}
              />
            </>
          )}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allowExternalForLocalOnly}
              onChange={(e) => setAllowExternalForLocalOnly(e.target.checked)}
            />
            允許把標記「僅限本機」（local_only）的資料也送到上面這個外部 API（預設關閉）
          </label>

          <button type="submit" disabled={saving}>
            {saving ? '儲存中…' : '儲存設定'}
          </button>
        </form>
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
      </section>

      <section aria-labelledby="privacy-heading" className="card">
        <h2 id="privacy-heading">關於「僅限本機」</h2>
        <p>
          上傳文件、或從網址擷取時可以勾選「僅限本機使用」。問答時只要檢索到的段落裡有一筆是這個標記，
          系統就不會把它的原文送進上面設定的外部 LLM，除非你勾了上面「允許送出」那個開關。
        </p>
        <p className="hint">
          這一層保護只擋住「送進 LLM 的 Context」，也就是聊天外流的原文——這是比
          Embedding 外流向量更嚴重的那條線。目前還沒有做到「local_only 的內容連 Embedding
          都強制走本地模型」，如果你的 Embedding 供應商本身就是外部 API（例如 Voyage），
          向量化那一步仍然會把文字送出去，這點請自行評估。
        </p>
      </section>
    </div>
  );
}
