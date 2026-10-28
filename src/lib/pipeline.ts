import type { AskResult, ScoredChunk } from './types';
import { embedQuery } from './embedding';
import { getStore } from './store';
import { generateAnswer, extractCitations, effectiveProvider, isExternalProvider } from './llm';
import { embeddingProvider, storeKind, topK } from './config';

/**
 * 整條 RAG 流程：Query → Embedding → Retrieval → Context → LLM → Answer ＋ Citation。
 * 這是整個專案唯一的「主線」，之後要加 Hybrid Search、Rerank、Query Rewrite，
 * 都是在這個函式裡多插一步，而不是另開一條路。
 */
export async function ask(question: string): Promise<AskResult> {
  const start = Date.now();
  const store = getStore();
  const settings = await store.getSettings();

  const vector = await embedQuery(question);
  const candidates = await store.vectorSearch(vector, topK());

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
