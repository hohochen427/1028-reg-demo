import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import type { LlmProviderKind } from '@/lib/types';

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}

export async function GET() {
  const store = getStore();
  const settings = await store.getSettings();
  return NextResponse.json({
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    allowExternalForLocalOnly: settings.allowExternalForLocalOnly,
    apiKeySet: Boolean(settings.apiKey),
    apiKeyMasked: maskKey(settings.apiKey),
  });
}

const VALID_PROVIDERS: LlmProviderKind[] = ['none', 'claude', 'gemini', 'openai_compatible'];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }

  const store = getStore();
  const current = await store.getSettings();

  const provider = VALID_PROVIDERS.includes(body.provider as LlmProviderKind)
    ? (body.provider as LlmProviderKind)
    : current.provider;
  const newApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';

  await store.setSettings({
    provider,
    // 空字串代表「這次沒有要改金鑰」，沿用原本存的那一組
    apiKey: newApiKey ? newApiKey : current.apiKey,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : current.baseUrl,
    model: typeof body.model === 'string' ? body.model : current.model,
    allowExternalForLocalOnly: Boolean(body.allowExternalForLocalOnly),
  });

  return NextResponse.json({ ok: true });
}
