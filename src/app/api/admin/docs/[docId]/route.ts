import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { requireAdmin } from '@/lib/session';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { docId } = await params;
  const store = getStore();
  await store.deleteByDocId(docId);
  return NextResponse.json({ ok: true });
}
