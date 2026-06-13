import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache the probe briefly. This endpoint is public (see middleware), so without
// a cache an unauthenticated flood would translate 1:1 into DB round-trips —
// a cheap DoS amplifier. A short TTL bounds DB load regardless of request rate
// while still being fresh enough for the deploy health gate and uptime checks.
const TTL_MS = 5000;
let cached: { at: number; ok: boolean } | null = null;

/**
 * Liveness + DB readiness probe. 200 = healthy, 503 = DB down. The response body
 * is intentionally minimal — no error detail — since it is unauthenticated and
 * Prisma error messages can leak DB host/credentials. Details are logged server-side.
 */
export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return respond(cached.ok);

  let ok = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok = true;
  } catch (e) {
    console.error('[health] db probe failed:', e);
  }
  cached = { at: now, ok };
  return respond(ok);
}

function respond(ok: boolean) {
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', db: ok ? 'up' : 'down', ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
