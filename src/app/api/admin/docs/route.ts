import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import type { Visibility } from '@/lib/types';

export async function GET() {
  const store = getStore();
  const all = await store.list(100000, 0);

  const byDoc = new Map<string, { docId: string; source: string; chunkCount: number; visibility: Visibility }>();
  for (const c of all) {
    const existing = byDoc.get(c.docId);
    if (existing) {
      existing.chunkCount += 1;
    } else {
      byDoc.set(c.docId, { docId: c.docId, source: c.source, chunkCount: 1, visibility: c.visibility });
    }
  }

  return NextResponse.json({
    storeKind: store.kind,
    total: all.length,
    docs: Array.from(byDoc.values()).sort((a, b) => a.source.localeCompare(b.source, 'zh-Hant')),
  });
}
