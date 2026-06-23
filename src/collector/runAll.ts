import { prisma } from '@/db/client';
import { runCollection } from './runCollection';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';
import { buildResourceContext } from '@/notify/context';
import { notifyResolvedIncidents } from '@/notify/resolve';

// A connection is considered stale when it hasn't collected in 4× the runAll cadence
// (5 min → 20 min). Past that, the loop is alive but this connection's collection has
// silently stalled (stuck lock, repeatedly skipped) and should surface as an incident.
const STALE_MS = 20 * 60_000;

export async function runAll(now: Date = new Date()): Promise<void> {
  const started = Date.now();
  const conns = await prisma.connection.findMany({ where: { status: { not: 'paused' } } });
  log.info('collector.runAll start', { count: conns.length });
  let success = 0;
  for (const c of conns) {
    try {
      await runCollection(c.id);
      success++;
    } catch (e) {
      log.error('runCollection failed', { connectionId: c.id, err: (e as Error).message });
    }
  }

  // Heartbeat: a single liveness record /api/health surfaces so a dead/hung scheduler is
  // detectable from outside (Nexus monitoring its own collector).
  try {
    const data = {
      lastRunAt: now,
      connectionCount: conns.length,
      durationMs: Date.now() - started,
      ...(success > 0 ? { lastSuccessAt: now } : {}),
    };
    await prisma.collectorHeartbeat.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
  } catch (e) {
    log.warn('heartbeat upsert failed', { err: (e as Error).message });
  }

  try {
    await evaluateStaleConnections(now);
  } catch (e) {
    log.warn('staleness eval failed', { err: (e as Error).message });
  }

  log.info('collector.runAll done', { success, total: conns.length });
}

/**
 * Open a `connection_stale` warn incident for any active connection whose collection has
 * gone quiet for longer than STALE_MS, and resolve it once collection resumes. The healthy
 * path never creates rows — the synthetic '__connection__' resource is only materialized
 * when we actually need to attach a stale incident.
 */
async function evaluateStaleConnections(now: Date): Promise<void> {
  const conns = await prisma.connection.findMany({ where: { status: 'active' } });
  for (const c of conns) {
    const stale = !c.lastCollectedAt || now.getTime() - c.lastCollectedAt.getTime() > STALE_MS;

    if (stale) {
      const target = await ensureConnectionResource(c.id, c.name);
      const existing = await prisma.incident.findFirst({
        where: { resourceId: target, type: 'connection_stale', resolvedAt: null },
      });
      if (existing) continue;
      const ageMin = c.lastCollectedAt ? Math.round((now.getTime() - c.lastCollectedAt.getTime()) / 60_000) : null;
      const inc = await prisma.incident.create({
        data: {
          resourceId: target,
          type: 'connection_stale',
          severity: 'warn',
          message: `${c.name} sem coletar há ${ageMin != null ? `${ageMin}min` : 'que se tem registro'}`,
          payload: { lastCollectedAt: c.lastCollectedAt?.toISOString() ?? null },
        },
      });
      const resource = await prisma.resource.findUniqueOrThrow({ where: { id: target } });
      const ctx = buildResourceContext(resource, 'open');
      try {
        for (const n of listNotifiers()) await n.notify(inc, ctx);
      } catch (e) {
        log.warn('stale open notify failed', { connectionId: c.id, err: (e as Error).message });
      }
      log.warn('connection stale', { connection: c.name, ageMin });
    } else {
      // Resolve via join through the connection — don't create a resource on the healthy path.
      const open = await prisma.incident.findMany({
        where: { resource: { connectionId: c.id }, type: 'connection_stale', resolvedAt: null },
        select: { id: true },
      });
      if (open.length === 0) continue;
      const ids = open.map((i) => i.id);
      await prisma.incident.updateMany({ where: { id: { in: ids }, resolvedAt: null }, data: { resolvedAt: now } });
      await notifyResolvedIncidents(ids);
    }
  }
}

/** Find or create the synthetic '__connection__' placeholder resource for a connection. */
async function ensureConnectionResource(connectionId: string, name: string): Promise<string> {
  const existing = await prisma.resource.findFirst({ where: { connectionId, externalId: '__connection__' } });
  if (existing) return existing.id;
  const any = await prisma.resource.findFirst({ where: { connectionId } });
  if (any) return any.id;
  const created = await prisma.resource.create({
    data: { connectionId, externalId: '__connection__', name, kind: 'connection', metadata: {} },
  });
  return created.id;
}
