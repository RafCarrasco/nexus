import { prisma } from '@/db/client';
import type { Prisma } from '@prisma/client';
import { getProvider } from '@/providers/registry';
import { decrypt } from '@/crypto/vault';
import { tryConnectionLock, releaseConnectionLock } from './lock';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';
import { buildResourceContext } from '@/notify/context';
import { notifyResolvedIncidents } from '@/notify/resolve';

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

    let view;
    try {
      view = { id: conn.id, type: conn.type, config: decrypt<Record<string, unknown>>(Buffer.from(conn.credentials)) };
    } catch (e) {
      await markError(connectionId, 'credentials decrypt failed: ' + (e as Error).message, null);
      return;
    }

    let resources;
    try {
      resources = await provider.listResources(view);
    } catch (e) {
      await markError(connectionId, (e as Error).message, null);
      return;
    }

    for (const r of resources) {
      try {
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
      } catch (e) {
        log.warn('resource upsert failed', { connectionId, externalId: r.externalId, err: (e as Error).message });
      }
    }

    await prisma.connection.update({
      where: { id: connectionId },
      data: { status: 'active', lastError: null, lastCollectedAt: new Date() },
    });

    // Recovered: resolve any open 'collection_failed' incidents for this connection.
    // markError can attach these to the synthetic '__connection__' resource, so resolve
    // by joining through the connection rather than a single resourceId.
    const openCollectionFailed = await prisma.incident.findMany({
      where: { resource: { connectionId }, type: 'collection_failed', resolvedAt: null },
      select: { id: true },
    });
    if (openCollectionFailed.length > 0) {
      const ids = openCollectionFailed.map((i) => i.id);
      await prisma.incident.updateMany({
        where: { id: { in: ids }, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      await notifyResolvedIncidents(ids);
    }
  } finally {
    await releaseConnectionLock(connectionId);
  }
}

async function markError(connectionId: string, message: string, resourceId: string | null) {
  const conn = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: 'error', lastError: message, lastCollectedAt: new Date() },
  });

  // Attach incident to existing or synthetic placeholder resource. The synthetic
  // '__connection__' resource is named after the connection so the channel label
  // reads as the connection, not the literal "connection".
  const target =
    resourceId ??
    (await prisma.resource.findFirst({ where: { connectionId } }))?.id ??
    (
      await prisma.resource.create({
        data: {
          connectionId,
          externalId: '__connection__',
          name: conn.name,
          kind: 'connection',
          metadata: {},
        },
      })
    ).id;

  // Dedup: don't pile up a new collection_failed incident every tick while the
  // connection stays broken. Mirror openIncidentOnce — connection.status/lastError
  // are still updated above regardless.
  const existing = await prisma.incident.findFirst({
    where: { resourceId: target, type: 'collection_failed', resolvedAt: null },
  });
  if (existing) return;

  const incident = await prisma.incident.create({
    data: {
      resourceId: target,
      type: 'collection_failed',
      severity: 'warn',
      message,
    },
  });
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: target } });
  const ctx = buildResourceContext(resource, 'open');
  try {
    for (const n of listNotifiers()) await n.notify(incident, ctx);
  } catch (e) {
    log.warn('notify failed', { connectionId, type: 'collection_failed', err: (e as Error).message });
  }
}

async function openIncidentOnce(resourceId: string, type: string, severity: string, message: string) {
  const existing = await prisma.incident.findFirst({ where: { resourceId, type, resolvedAt: null } });
  if (existing) return;
  const inc = await prisma.incident.create({ data: { resourceId, type, severity, message } });
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } });
  const ctx = buildResourceContext(resource, 'open');
  try {
    for (const n of listNotifiers()) await n.notify(inc, ctx);
  } catch (e) {
    log.warn('notify failed', { resourceId, type, err: (e as Error).message });
  }
}

async function resolveOpen(resourceId: string, type: string) {
  // Select-then-update so we know exactly which incidents we resolved this tick and
  // can fire resolve notifications for each (updateMany alone gives only a count).
  const open = await prisma.incident.findMany({
    where: { resourceId, type, resolvedAt: null },
    select: { id: true },
  });
  if (open.length === 0) return;
  const resolvedAt = new Date();
  const ids = open.map((i) => i.id);
  await prisma.incident.updateMany({
    where: { id: { in: ids }, resolvedAt: null },
    data: { resolvedAt },
  });
  // Re-fetch in one query AFTER the update so resolvedAt is stamped (notify-format reads it).
  const resolved = await prisma.incident.findMany({ where: { id: { in: ids } } });
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } });
  const ctx = buildResourceContext(resource, 'resolve');
  try {
    for (const inc of resolved) {
      for (const n of listNotifiers()) await n.notify(inc, ctx);
    }
  } catch (e) {
    log.warn('notify failed', { resourceId, type, err: (e as Error).message });
  }
}
