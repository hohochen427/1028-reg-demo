import { NextRequest, NextResponse } from 'next/server';
import { parseUpload, slugifyDocId } from '@/lib/parseUpload';
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤（需要 multipart/form-data）' }, { status: 400 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: '請至少選擇一個檔案' }, { status: 400 });
  }

  const options = {
    maxChars: clampInt(form.get('maxChars'), DEFAULT_CHUNK_OPTIONS.maxChars, 100, 2000),
    overlapChars: clampInt(form.get('overlapChars'), DEFAULT_CHUNK_OPTIONS.overlapChars, 0, 400),
    keepHeading: form.get('keepHeading') !== 'false',
  };
  const visibility = form.get('visibility') === 'local_only' ? 'local_only' : 'public';
  // 可見群組：空白＝所有登入者都看得到
  const allowedGroups = normalizeGroups(form.get('allowedGroups'));

  const store = getStore();
  const results: Array<{ fileName: string; docId: string; chunkCount: number; error?: string }> = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { text, format } = await parseUpload(file.name, buffer);
      const docId = slugifyDocId(file.name);
      const titleHint = file.name.replace(/\.[^.]+$/, '');
      const prepared = prepareDocument(text, options, format, titleHint);

      if (prepared.pieces.length === 0) {
        results.push({ fileName: file.name, docId, chunkCount: 0, error: '解析後沒有可用的文字內容' });
        continue;
      }

      const source = prepared.docTitle || titleHint;
      const vectors = await embedDocuments(prepared.pieces.map((p) => p.text));

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

      results.push({ fileName: file.name, docId, chunkCount: prepared.pieces.length });
    } catch (err) {
      results.push({
        fileName: file.name,
        docId: slugifyDocId(file.name),
        chunkCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results, storeKind: store.kind });
}
