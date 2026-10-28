import type { AskResult, ScoredChunk, SessionUser, Viewer } from './types';
import { embedQuery } from './embedding';
import { getStore } from './store';
import { generateAnswer, extractCitations, effectiveProvider, isExternalProvider } from './llm';
import { embeddingProvider, storeKind, topK } from './config';

/**
 * 整條 RAG 流程：Query → Embedding → Retrieval → Context → LLM → Answer ＋ Citation。
 * 這是整個專案唯一的「主線」，之後要加 Hybrid Search、Rerank、Query Rewrite，
 * 都是在這個函式裡多插一步，而不是另開一條路。
 */
export async function ask(question: string, user: SessionUser): Promise<AskResult> {
  const start = Date.now();
  const store = getStore();
  const settings = await store.getSettings();

  const vector = await embedQuery(question);
  // 權限在檢索層擋：把目前登入者的 groups 與 role 傳給兩條檢索，看不到的 Chunk 根本不會被撈出來
  const viewer: Viewer = { groups: user.groups, role: user.role };
  const vectorHits = await store.vectorSearch(vector, topK(), viewer);
  const terms = extractKeywords(question);
  const keywordHits = terms.length > 0 ? await store.keywordSearch(terms, topK(), viewer) : [];
  const candidates = mergeKeywordFirst(keywordHits, vectorHits, topK());

  // local_only 的資料絕不送到外部 LLM，除非在 /settings 明確打開開關
  const provider = effectiveProvider(settings);
  const blockExternal = isExternalProvider(provider.kind) && !settings.allowExternalForLocalOnly;
  const context: ScoredChunk[] = blockExternal
    ? candidates.filter((c) => c.visibility !== 'local_only')
    : candidates;
  const withheldCount = candidates.length - context.length;

  const { answer, provider: providerLabel, warning } = await generateAnswer(question, context, settings);
  const citations = extractCitations(answer, context);

  return {
    question,
    candidates,
    answer,
    citations,
    llmProvider: providerLabel,
    embeddingProvider: embeddingProvider(),
    storeKind: storeKind(),
    elapsedMs: Date.now() - start,
    warning,
    withheldCount,
  };
}

/**
 * 從問題裡抓出「向量搜尋容易漏掉」的精確字串：
 * 1. 像 ERR-PAY-202 這種英數加連字號的代碼（至少要有一個英文字母）
 * 2. 三位數以上的數字
 * 去重後回傳；沒抓到就回傳空陣列，呼叫端就不會做關鍵字搜尋。
 */
export function extractKeywords(question: string): string[] {
  const codes = question.match(/\b(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g) ?? [];
  const numbers = question.match(/\d{3,}/g) ?? [];
  return Array.from(new Set([...codes, ...numbers]));
}

/**
 * 關鍵字命中的放最前面，再用向量結果補滿；重複的 id 只留一份，最多 k 筆。
 */
export function mergeKeywordFirst(
  keywordHits: ScoredChunk[],
  vectorHits: ScoredChunk[],
  k: number,
): ScoredChunk[] {
  const seen = new Set<string>();
  const merged: ScoredChunk[] = [];
  for (const chunk of [...keywordHits, ...vectorHits]) {
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    merged.push(chunk);
    if (merged.length >= k) break;
  }
  return merged;
}
