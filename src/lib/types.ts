export type Visibility = 'public' | 'local_only';

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
