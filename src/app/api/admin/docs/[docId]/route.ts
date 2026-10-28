import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const store = getStore();
  await store.deleteByDocId(docId);
  return NextResponse.json({ ok: true });
}
