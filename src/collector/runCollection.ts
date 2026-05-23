import { prisma } from '@/db/client';
import type { Prisma } from '@prisma/client';
import { getProvider } from '@/providers/registry';
import { decrypt } from '@/crypto/vault';
import { tryConnectionLock, releaseConnectionLock } from './lock';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';

export async function runCollection(connectionId: string): Promise<void> {
  const acquired = await tryConnectionLock(connectionId);
  if (!acquired) {
    log.info('skip: lock held', { connectionId });
    return;
  }
  try {
    const conn = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
    const provider = (() => {
      try {
        return getProvider(conn.type);
      } catch {
        return null;
      }
    })();

    if (!provider) {
      await markError(connectionId, `unknown provider type: ${conn.type}`, null);
      return;
    }

    const view = { id: conn.id, type: conn.type, config: decrypt<Record<string, unknown>>(Buffer.from(conn.credentials)) };

    let resources;
    try {
      resources = await provider.listResources(view);
    } catch (e) {
      await markError(connectionId, (e as Error).message, null);
      return;
    }

    for (const r of resources) {
      const dbRes = await prisma.resource.upsert({
        where: { connectionId_externalId: { connectionId, externalId: r.externalId } },
        create: {
          connectionId,
          externalId: r.externalId,
          name: r.name,
          kind: r.kind,
          region: r.region,
          metadata: r.metadata as Prisma.JsonObject,
        },
        update: { name: r.name, kind: r.kind, region: r.region, metadata: r.metadata as Prisma.JsonObject },
      });

      // activity
      try {
        const lastSeen = await provider.getLastActivity(view, r.externalId);
        await prisma.activityLog.upsert({
          where: { resourceId: dbRes.id },
          create: { resourceId: dbRes.id, lastSeenAt: lastSeen, source: provider.type },
          update: { lastSeenAt: lastSeen, source: provider.type },
        });
      } catch (e) {
        log.warn('activity failed', { resourceId: dbRes.id, err: (e as Error).message });
      }

      // health
      try {
        const h = await provider.getHealth(view, r.externalId);
        if (h.status === 'down' || h.status === 'degraded') {
          await openIncidentOnce(dbRes.id, 'health_bad', h.status === 'down' ? 'crit' : 'warn', h.message ?? h.status);
        } else {
          await resolveOpen(dbRes.id, 'health_bad');
        }
      } catch (e) {
        log.warn('health failed', { resourceId: dbRes.id, err: (e as Error).message });
      }

      // tenants
      try {
        const tenants = await provider.listTenants(view, r.externalId);
        for (const t of tenants) {
          await prisma.tenant.upsert({
            where: { resourceId_externalId: { resourceId: dbRes.id, externalId: t.externalId } },
            create: { resourceId: dbRes.id, externalId: t.externalId, displayName: t.displayName },
            update: { displayName: t.displayName },
          });
        }
      } catch (e) {
        log.warn('tenants failed', { resourceId: dbRes.id, err: (e as Error).message });
      }
    }

    await prisma.connection.update({
      where: { id: connectionId },
      data: { status: 'active', lastError: null, lastCollectedAt: new Date() },
    });
  } finally {
    await releaseConnectionLock(connectionId);
  }
}

async function markError(connectionId: string, message: string, resourceId: string | null) {
  await prisma.connection.update({
    where: { id: connectionId },
    data: { status: 'error', lastError: message, lastCollectedAt: new Date() },
  });

  // Attach incident to existing or synthetic placeholder resource.
  const target =
    resourceId ??
    (await prisma.resource.findFirst({ where: { connectionId } }))?.id ??
    (
      await prisma.resource.create({
        data: {
          connectionId,
          externalId: '__connection__',
          name: 'connection',
          kind: 'connection',
          metadata: {},
        },
      })
    ).id;

  const incident = await prisma.incident.create({
    data: {
      resourceId: target,
      type: 'collection_failed',
      severity: 'warn',
      message,
    },
  });
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: target } });
  for (const n of listNotifiers()) await n.notify(incident, resource);
}

async function openIncidentOnce(resourceId: string, type: string, severity: string, message: string) {
  const existing = await prisma.incident.findFirst({ where: { resourceId, type, resolvedAt: null } });
  if (existing) return;
  const inc = await prisma.incident.create({ data: { resourceId, type, severity, message } });
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } });
  for (const n of listNotifiers()) await n.notify(inc, resource);
}

async function resolveOpen(resourceId: string, type: string) {
  await prisma.incident.updateMany({
    where: { resourceId, type, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}
