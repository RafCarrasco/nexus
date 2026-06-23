import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache the probe briefly. This endpoint is public (see middleware), so without
// a cache an unauthenticated flood would translate 1:1 into DB round-trips —
// a cheap DoS amplifier. A short TTL bounds DB load regardless of request rate
// while still being fresh enough for the deploy health gate and uptime checks.
const TTL_MS = 5000;
// >15 min since the last runAll tick (cadence is 5 min) means the scheduler missed
// several runs — likely crashed/hung. Surfaced as info; never gates the 200/503 (a fresh
// deploy hasn't ticked yet, and the deploy health gate must still pass).
const COLLECTOR_STALE_SEC = 900;

type CollectorInfo = { lastRunAt: string | null; ageSec: number | null; stale: boolean };
let cached: { at: number; ok: boolean; collector: CollectorInfo } | null = null;

/**
 * Liveness + DB readiness probe. 200 = healthy, 503 = DB down. The response body
 * is intentionally minimal — no error detail — since it is unauthenticated and
 * Prisma error messages can leak DB host/credentials. Details are logged server-side.
 * Also reports collector heartbeat age so a dead scheduler is observable externally.
 */
export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return respond(cached.ok, cached.collector);

  let ok = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok = true;
  } catch (e) {
    console.error('[health] db probe failed:', e);
  }

  let collector: CollectorInfo = { lastRunAt: null, ageSec: null, stale: false };
  try {
    const hb = await prisma.collectorHeartbeat.findUnique({ where: { id: 'singleton' } });
    if (hb?.lastRunAt) {
      const ageSec = Math.round((now - hb.lastRunAt.getTime()) / 1000);
      collector = { lastRunAt: hb.lastRunAt.toISOString(), ageSec, stale: ageSec > COLLECTOR_STALE_SEC };
    }
  } catch {
    // best-effort: collector info must never break the liveness probe
  }

  cached = { at: now, ok, collector };
  return respond(ok, collector);
}

function respond(ok: boolean, collector: CollectorInfo) {
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', db: ok ? 'up' : 'down', collector, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
