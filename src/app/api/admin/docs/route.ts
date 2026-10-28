import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { getStore } from '@/lib/store';
import type { Visibility } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const store = getStore();
  const all = await store.list(100000, 0);

  const byDoc = new Map<
    string,
    { docId: string; source: string; chunkCount: number; visibility: Visibility; allowedGroups: string[] }
  >();
  for (const c of all) {
    const existing = byDoc.get(c.docId);
    if (existing) {
      existing.chunkCount += 1;
    } else {
      byDoc.set(c.docId, {
        docId: c.docId,
        source: c.source,
        chunkCount: 1,
        visibility: c.visibility,
        allowedGroups: c.allowedGroups,
      });
    }
  }

  return NextResponse.json({
    storeKind: store.kind,
    total: all.length,
    docs: Array.from(byDoc.values()).sort((a, b) => a.source.localeCompare(b.source, 'zh-Hant')),
  });
}
