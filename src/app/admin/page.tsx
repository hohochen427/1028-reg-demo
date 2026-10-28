'use client';

import { useEffect, useState, useCallback } from 'react';

interface DocRow {
  docId: string;
  source: string;
  chunkCount: number;
  visibility: 'public' | 'local_only';
  allowedGroups: string[];
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  groups: string[];
}

interface UploadResult {
  fileName: string;
  docId: string;
  chunkCount: number;
  error?: string;
}

export default function AdminPage() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [storeKind, setStoreKind] = useState('');
  const [maxChars, setMaxChars] = useState(320);
  const [overlapChars, setOverlapChars] = useState(40);
  const [keepHeading, setKeepHeading] = useState(true);
  const [visibility, setVisibility] = useState<'public' | 'local_only'>('public');
  const [allowedGroups, setAllowedGroups] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState('');

  const [url, setUrl] = useState('');
  const [urlVisibility, setUrlVisibility] = useState<'public' | 'local_only'>('public');
  const [urlGroups, setUrlGroups] = useState('');
  const [fetching, setFetching] = useState(false);
  const [urlMessage, setUrlMessage] = useState('');
  const [urlError, setUrlError] = useState('');

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [newGroups, setNewGroups] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUserError(data.error ?? '讀取使用者失敗');
      setUsers([]);
      return;
    }
    setUsers(data.users);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/admin/docs');
    if (!res.ok) return;
    const data = await res.json();
    setDocs(data.docs);
    setStoreKind(data.storeKind);
  }, []);

  useEffect(() => {
    loadDocs();
    loadUsers();
  }, [loadDocs, loadUsers]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setUserError('');
    setUserMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword,
          role: newRole,
          groups: newGroups,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '新增使用者失敗');
      setUserMessage(`已新增「${data.user.name}」（${data.user.email}）。`);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('member');
      setNewGroups('');
      await loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : '新增使用者失敗');
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('files') as HTMLInputElement;
    if (!fileInput.files || fileInput.files.length === 0) {
      setError('請先選擇檔案');
      return;
    }
    setUploading(true);
    setError('');
    setUploadResults(null);
    try {
      const body = new FormData();
      for (const file of Array.from(fileInput.files)) body.append('files', file);
      body.set('maxChars', String(maxChars));
      body.set('overlapChars', String(overlapChars));
      body.set('keepHeading', String(keepHeading));
      body.set('visibility', visibility);
      body.set('allowedGroups', allowedGroups);

      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '上傳失敗');
      setUploadResults(data.results);
      form.reset();
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setFetching(true);
    setUrlError('');
    setUrlMessage('');
    try {
      const res = await fetch('/api/admin/fetch-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          maxChars,
          overlapChars,
          keepHeading,
          visibility: urlVisibility,
          allowedGroups: urlGroups,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '擷取失敗');
      setUrlMessage(`已建「${data.source}」，共 ${data.chunkCount} 塊切片。`);
      setUrl('');
      await loadDocs();
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : '擷取失敗');
    } finally {
      setFetching(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm(`確定要刪除「${docId}」的所有切片嗎？`)) return;
    await fetch(`/api/admin/docs/${encodeURIComponent(docId)}`, { method: 'DELETE' });
    await loadDocs();
  }

  return (
    <div className="page">
      {storeKind === 'file' && (
        <p role="alert" className="error">
          目前儲存層是 <code>file</code>（本機離線模式）。部署在 Vercel 等無狀態環境時，上傳的內容不會保留，
          請先依 README 接上 Neon（<code>RAG_STORE=pg</code>）再上傳。
        </p>
      )}

      <section aria-labelledby="users-heading" className="card">
        <h2 id="users-heading">使用者管理</h2>
        <form onSubmit={handleCreateUser}>
          <div className="field-row">
            <div>
              <label htmlFor="newEmail">Email</label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div>
              <label htmlFor="newName">名稱</label>
              <input
                id="newName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="newPassword">初始密碼（至少 8 個字元）</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div>
              <label htmlFor="newRole">角色</label>
              <select id="newRole" value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'member')}>
                <option value="member">member（一般成員）</option>
                <option value="admin">admin（管理員）</option>
              </select>
            </div>
          </div>

          <label htmlFor="newGroups">群組（用逗號分隔，例如 hr, sales）</label>
          <input
            id="newGroups"
            type="text"
            value={newGroups}
            onChange={(e) => setNewGroups(e.target.value)}
            placeholder="hr"
            autoComplete="off"
          />

          <button type="submit" disabled={creatingUser}>
            {creatingUser ? '新增中…' : '新增使用者'}
          </button>
        </form>
        {userError && (
          <p role="alert" className="error">
            {userError}
          </p>
        )}
        {userMessage && (
          <p role="status" aria-live="polite">
            {userMessage}
          </p>
        )}

        {users === null && <p>載入中…</p>}
        {users !== null && users.length === 0 && <p>目前沒有使用者。</p>}
        {users !== null && users.length > 0 && (
          <table className="docs-table" aria-label="現有使用者">
            <thead>
              <tr>
                <th scope="col">名稱</th>
                <th scope="col">Email</th>
                <th scope="col">角色</th>
                <th scope="col">群組</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.groups.length === 0 ? (
                      <span className="hint">（無）</span>
                    ) : (
                      u.groups.map((g) => (
                        <span key={g} className="badge lock">
                          {g}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="upload-heading" className="card">
        <h2 id="upload-heading">上傳文件</h2>
        <form onSubmit={handleUpload}>
          <label htmlFor="files">選擇檔案（可多選，支援 .md / .txt / .pdf / .docx）</label>
          <input id="files" name="files" type="file" multiple accept=".md,.markdown,.txt,.pdf,.docx" />

          <div className="field-row">
            <div>
              <label htmlFor="maxChars">切片大小（字元）</label>
              <input
                id="maxChars"
                type="number"
                min={100}
                max={2000}
                value={maxChars}
                onChange={(e) => setMaxChars(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="overlapChars">切片重疊（字元）</label>
              <input
                id="overlapChars"
                type="number"
                min={0}
                max={400}
                value={overlapChars}
                onChange={(e) => setOverlapChars(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={keepHeading}
              onChange={(e) => setKeepHeading(e.target.checked)}
            />
            把文件名稱／章節帶進每個切片正文（建議保持開啟）
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={visibility === 'local_only'}
              onChange={(e) => setVisibility(e.target.checked ? 'local_only' : 'public')}
            />
            僅限本機使用（local_only）：問答時不送到 /settings 設定的外部 LLM
          </label>

          <label htmlFor="allowedGroups">可見群組（用逗號分隔，例如 hr, sales；留白＝所有登入者都看得到）</label>
          <input
            id="allowedGroups"
            type="text"
            value={allowedGroups}
            onChange={(e) => setAllowedGroups(e.target.value)}
            placeholder="hr"
            autoComplete="off"
          />

          <button type="submit" disabled={uploading}>
            {uploading ? '處理中…' : '上傳並建庫'}
          </button>
        </form>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {uploadResults && (
          <ul className="upload-results" aria-live="polite">
            {uploadResults.map((r) => (
              <li key={r.fileName} className={r.error ? 'error' : ''}>
                {r.fileName}：{r.error ?? `已建 ${r.chunkCount} 塊切片（docId: ${r.docId}）`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="url-heading" className="card">
        <h2 id="url-heading">從網址擷取</h2>
        <form onSubmit={handleFetchUrl}>
          <label htmlFor="url">網址</label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={urlVisibility === 'local_only'}
              onChange={(e) => setUrlVisibility(e.target.checked ? 'local_only' : 'public')}
            />
            僅限本機使用（local_only）
          </label>
          <label htmlFor="urlGroups">可見群組（用逗號分隔；留白＝所有登入者都看得到）</label>
          <input
            id="urlGroups"
            type="text"
            value={urlGroups}
            onChange={(e) => setUrlGroups(e.target.value)}
            placeholder="hr"
            autoComplete="off"
          />
          <button type="submit" disabled={fetching || !url.trim()}>
            {fetching ? '擷取中…' : '擷取並建庫'}
          </button>
        </form>
        <p className="hint">用的是上面同一組切片大小／重疊設定。JS 動態載入的頁面抓不到內容，那種請改用複製貼上存成 .txt 上傳。</p>
        {urlError && (
          <p role="alert" className="error">
            {urlError}
          </p>
        )}
        {urlMessage && (
          <p role="status" aria-live="polite">
            {urlMessage}
          </p>
        )}
      </section>

      <section aria-labelledby="docs-heading" className="card">
        <h2 id="docs-heading">知識庫裡的文件</h2>
        {docs === null && <p>載入中…</p>}
        {docs !== null && docs.length === 0 && <p>知識庫目前是空的，先在上面上傳文件。</p>}
        {docs !== null && docs.length > 0 && (
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">文件</th>
                <th scope="col">docId</th>
                <th scope="col">切片數</th>
                <th scope="col">可見範圍</th>
                <th scope="col">可見群組</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.docId}>
                  <td>{d.source}</td>
                  <td>
                    <code>{d.docId}</code>
                  </td>
                  <td>{d.chunkCount}</td>
                  <td>
                    {d.visibility === 'local_only' ? (
                      <span className="badge lock">僅限本機</span>
                    ) : (
                      <span className="badge ok">一般</span>
                    )}
                  </td>
                  <td>
                    {d.allowedGroups.length === 0 ? (
                      <span className="badge ok">所有登入者</span>
                    ) : (
                      d.allowedGroups.map((g) => (
                        <span key={g} className="badge lock">
                          {g}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <button type="button" className="danger" onClick={() => handleDelete(d.docId)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
