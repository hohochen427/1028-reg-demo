export type Visibility = 'public' | 'local_only';

export type Role = 'admin' | 'member';

/** 登入後 session 裡帶的使用者資訊（只放檢索與授權需要的欄位） */
export interface SessionUser {
  id: string;
  role: Role;
  groups: string[];
}

/** 檢索層用來過濾 Chunk 的身分：只需要 groups 與 role */
export interface Viewer {
  groups: string[];
  role: Role;
}

/** users 資料表的一列（含密碼雜湊，只能在伺服器端使用，絕不回傳給前端） */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  groups: string[];
}

/** 可以安全回傳給前端的使用者資料（沒有密碼雜湊） */
export type PublicUser = Omit<UserRecord, 'passwordHash'>;

/** 一塊 Chunk：Vector ＋ 正文 ＋ 最小夠用的 Metadata */
export interface StoredChunk {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
  source: string;
  section: string;
  chunkIndex: number;
  /** local_only：絕不送到外部 LLM（除非在設定頁明確打開開關），資料外洩的是原文，比 embedding 外洩的向量嚴重 */
  visibility: Visibility;
  /** 可見群組；空陣列代表所有登入者都看得到，admin 永遠看得到 */
  allowedGroups: string[];
}

/** 檢索結果：多一個分數 */
export interface ScoredChunk extends Omit<StoredChunk, 'embedding'> {
  score: number;
}

export interface Citation {
  marker: number;
  source: string;
  section: string;
}

/** 一次問答的完整結果，前端用它畫出「檢索到什麼」與「回答是什麼」 */
export interface AskResult {
  question: string;
  candidates: ScoredChunk[];
  answer: string;
  citations: Citation[];
  llmProvider: string;
  embeddingProvider: string;
  storeKind: string;
  elapsedMs: number;
  warning?: string;
  /** 因為是 local_only、而目前的供應商是外部 API，被排除在送出去的 Context 之外的筆數 */
  withheldCount: number;
}

export type LlmProviderKind = 'none' | 'claude' | 'gemini' | 'openai_compatible';

/** 存在 Store 裡的執行期設定：使用者在 /settings 貼的 BYOK 金鑰與隱私開關 */
export interface RuntimeSettings {
  provider: LlmProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 預設關閉：local_only 的資料是否也允許送到外部 LLM */
  allowExternalForLocalOnly: boolean;
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  provider: 'none',
  apiKey: '',
  baseUrl: '',
  model: '',
  allowExternalForLocalOnly: false,
};
