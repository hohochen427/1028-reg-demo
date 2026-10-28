import { NextRequest, NextResponse } from 'next/server';
import { htmlToText } from '@/lib/htmlToText';
import { slugifyDocId } from '@/lib/parseUpload';
import { prepareDocument, DEFAULT_CHUNK_OPTIONS } from '@/lib/chunk';
import { embedDocuments } from '@/lib/embedding';
import { getStore } from '@/lib/store';
import { normalizeGroups } from '@/lib/access';
import { requireAdmin } from '@/lib/session';

export const runtime = 'nodejs';

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url.trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: '請輸入有效的網址（需以 http:// 或 https:// 開頭）' }, { status: 400 });
  }

  const options = {
    maxChars: clampInt((body as Record<string, unknown>).maxChars, DEFAULT_CHUNK_OPTIONS.maxChars, 100, 2000),
    overlapChars: clampInt((body as Record<string, unknown>).overlapChars, DEFAULT_CHUNK_OPTIONS.overlapChars, 0, 400),
    keepHeading: (body as Record<string, unknown>).keepHeading !== false,
  };
  const visibility = (body as Record<string, unknown>).visibility === 'local_only' ? 'local_only' : 'public';
  const allowedGroups = normalizeGroups((body as Record<string, unknown>).allowedGroups);

  let html: string;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; RAG-demo/1.0)' } });
    if (!res.ok) throw new Error(`網頁回應 ${res.status}`);
    html = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: `抓取失敗：${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const { text, title } = htmlToText(html);
  if (!text) {
    return NextResponse.json({ error: '這個網頁抓不到文字內容（可能是 JS 動態載入的頁面）' }, { status: 422 });
  }

  const titleHint = title || url;
  const prepared = prepareDocument(text, options, 'text', titleHint);
  if (prepared.pieces.length === 0) {
    return NextResponse.json({ error: '解析後沒有可用的文字內容' }, { status: 422 });
  }

  const docId = slugifyDocId(titleHint) || slugifyDocId(url);
  const source = prepared.docTitle || titleHint;
  const vectors = await embedDocuments(prepared.pieces.map((p) => p.text));

  const store = getStore();
  await store.deleteByDocId(docId);
  await store.insert(
    prepared.pieces.map((piece, i) => ({
      id: `${docId}#${piece.chunkIndex}`,
      docId,
      text: piece.text,
      embedding: vectors[i],
      source,
      section: piece.section,
      chunkIndex: piece.chunkIndex,
      visibility,
      allowedGroups,
    })),
  );

  return NextResponse.json({ docId, source, chunkCount: prepared.pieces.length, storeKind: store.kind });
}
