import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + DB readiness probe. Public (see middleware) so the deploy pipeline
 * and external uptime checks can hit it without auth. 200 = healthy, 503 = DB down.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'up', ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { status: 'degraded', db: 'down', error: (e as Error).message, ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
