import { NextRequest, NextResponse } from 'next/server';
import { ask } from '@/lib/pipeline';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: '尚未登入' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const question = typeof (body as { question?: unknown })?.question === 'string'
    ? ((body as { question: string }).question).trim()
    : '';
  if (!question) {
    return NextResponse.json({ error: '請輸入問題' }, { status: 400 });
  }

  try {
    const result = await ask(question, user);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '伺服器發生未預期的錯誤' },
      { status: 500 },
    );
  }
}
