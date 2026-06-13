import { NextResponse } from 'next/server';
import { auth } from '@/auth/config';
import { loadAiConfig, callLlm, type ChatMsg } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const body = (await req.json()) as { messages?: ChatMsg[] };
  if (!body.messages?.length) return new NextResponse('messages required', { status: 400 });

  // Provider + key live server-side (encrypted), configured in Settings → IA.
  const cfg = await loadAiConfig();
  if (!cfg) return new NextResponse('IA não configurada — configure em Configurações → IA', { status: 409 });

  try {
    const reply = await callLlm(cfg, body.messages);
    return NextResponse.json({ reply });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 502 });
  }
}
