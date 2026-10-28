export function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const storeKind = () => (env('RAG_STORE', 'file') === 'pg' ? 'pg' : 'file');
export const embeddingProvider = () =>
  env('EMBEDDING_PROVIDER', 'local') === 'voyage' ? 'voyage' : 'local';
export const llmProvider = () => (env('LLM_PROVIDER', 'local') === 'claude' ? 'claude' : 'local');
export const embeddingDim = () => Number(env('EMBEDDING_DIM', '256')) || 256;
export const topK = () => Math.min(10, Math.max(1, Number(env('TOP_K', '4')) || 4));
