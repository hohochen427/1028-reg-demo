import { embeddingDim, embeddingProvider, env } from './config';

/**
 * Embedding
 * provider = voyage：真正的語意向量，正式部署用，建庫與查詢必須用同一個模型。
 * provider = local：離線字元 n-gram 向量，只是為了讓沒有金鑰的人先跑起來，
 *                   它比較的是字面重疊，不是語意，換句話問會明顯比較弱。
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function localEmbed(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const cleaned = text.replace(/\s+/g, '');
  const grams: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    grams.push(cleaned[i]);
    if (i + 1 < cleaned.length) grams.push(cleaned.slice(i, i + 2));
    if (i + 2 < cleaned.length) grams.push(cleaned.slice(i, i + 3));
  }
  for (const g of grams) {
    const idx = hashString(g) % dim;
    const sign = hashString(`s:${g}`) % 2 === 0 ? 1 : -1;
    vec[idx] += sign * (g.length === 1 ? 0.6 : 1);
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function voyageEmbed(texts: string[], inputType: 'document' | 'query'): Promise<number[][]> {
  const apiKey = env('VOYAGE_API_KEY');
  if (!apiKey) throw new Error('EMBEDDING_PROVIDER=voyage 但缺少 VOYAGE_API_KEY');
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: texts, model: env('VOYAGE_MODEL', 'voyage-3'), input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage API 回應 ${res.status}：${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** 建庫端：這些文字是「要被搜尋的文件」 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (embeddingProvider() === 'voyage') return voyageEmbed(texts, 'document');
  const dim = embeddingDim();
  return texts.map((t) => localEmbed(t, dim));
}

/** 查詢端：這段文字是「拿來搜尋的問題」，有些模型兩邊設定不同 */
export async function embedQuery(text: string): Promise<number[]> {
  if (embeddingProvider() === 'voyage') return (await voyageEmbed([text], 'query'))[0];
  return localEmbed(text, embeddingDim());
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
