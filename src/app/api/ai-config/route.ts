import { NextResponse } from 'next/server';
import { auth } from '@/auth/config';
import { prisma } from '@/db/client';
import { DEFAULT_MODEL, isAiProvider, AI_CONFIG_ID, type AiProvider } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Non-sensitive status of the AI chat config, for the chat widget to know whether
 * it can send and which provider/model is active. NEVER returns the API key.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const row = await prisma.aiConfig.findUnique({
    where: { id: AI_CONFIG_ID },
    select: { provider: true, model: true },
  });
  if (!row) return NextResponse.json({ configured: false });

  const provider: AiProvider = isAiProvider(row.provider) ? row.provider : 'anthropic';
  return NextResponse.json({
    configured: true,
    provider,
    model: row.model || DEFAULT_MODEL[provider],
  });
}
