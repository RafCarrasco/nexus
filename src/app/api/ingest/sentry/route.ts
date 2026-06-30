import { NextResponse } from 'next/server';
import type { Connection } from '@prisma/client';
import { prisma } from '@/db/client';
import { hashToken } from '@/lib/ingest-token';
import { mapSentryWebhook } from '@/lib/sentry-webhook';
import { listNotifiers } from '@/notify/registry';
import { buildResourceContext } from '@/notify/context';
import { notifyResolvedIncidents } from '@/notify/resolve';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sentry webhook receiver. Sentry controls its own request headers (no custom Bearer), so
 * the ingest token is accepted from `?token=` OR an Authorization: Bearer header — paste the
 * `?token=` form into the Sentry alert-rule/integration webhook URL. The token must belong
 * to a `sentry`-type connection. Each Sentry issue maps to a `sentry_issue:<id>` incident on
 * a per-project Resource. Hardened against a hostile payload: a missing issue id is dropped
 * (never collapsed onto the project), every stored string is length-clamped in the parser,
 * a per-connection resource cap bounds row growth, a recently-resolved guard blocks
 * out-of-order re-opens, and ALL errors return 200 so a transient DB fault can't trigger a
 * Sentry retry storm.
 */

const BEARER_RE = /^Bearer\s+(\S+)$/i;
// Bound row growth from a flood of distinct project slugs on one connection.
const MAX_RESOURCES_PER_CONNECTION = 1000;
// A 'created' webhook that lands within this window after a resolve is treated as
// out-of-order delivery and ignored, so a stale event can't re-open a resolved issue.
const RECENT_RESOLVE_MS = 15 * 60_000;

type Gate = { connection: Connection; response?: undefined } | { connection?: undefined; response: NextResponse };

async function assertSentryToken(req: Request, url: URL): Promise<Gate> {
  const raw = url.searchParams.get('token') || (BEARER_RE.exec(req.headers.get('authorization') ?? '')?.[1] ?? '');
  if (!raw) return { response: new NextResponse('unauthorized', { status: 401 }) };

  const token = await prisma.ingestToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || (token.expiresAt && token.expiresAt.getTime() < Date.now())) {
    return { response: new NextResponse('unauthorized', { status: 401 }) };
  }
  const connection = await prisma.connection.findUnique({ where: { id: token.connectionId } });
  if (!connection || connection.type !== 'sentry') {
    return { response: new NextResponse('unauthorized', { status: 401 }) };
  }
  if (connection.status !== 'active') {
    return { response: new NextResponse('connection is not active', { status: 409 }) };
  }
  prisma.ingestToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch((e) => log.warn('sentry token lastUsedAt update failed', { err: (e as Error).message }));
  return { connection };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const gate = await assertSentryToken(req, url);
  if (gate.response) return gate.response;
  const { connection } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('invalid JSON body', { status: 400 });
  }

  const parsed = mapSentryWebhook(body);
  if (!parsed) return NextResponse.json({ ok: true, ignored: 'no issue in payload' });
  // No stable issue id → un-actionable. Drop it rather than collapse every project issue
  // onto a single `sentry_issue:<slug>` incident.
  if (!parsed.issueId) return NextResponse.json({ ok: true, ignored: 'no issue id' });

  try {
    const now = new Date();
    const slug = parsed.projectSlug ?? 'sentry';

    const existingResource = await prisma.resource.findUnique({
      where: { connectionId_externalId: { connectionId: connection.id, externalId: slug } },
      select: { id: true },
    });
    if (!existingResource) {
      const count = await prisma.resource.count({ where: { connectionId: connection.id } });
      if (count >= MAX_RESOURCES_PER_CONNECTION) {
        log.warn('sentry resource cap hit', { connectionId: connection.id, slug });
        return NextResponse.json({ ok: false, error: 'resource cap reached' }, { status: 429 });
      }
    }

    const resource = await prisma.resource.upsert({
      where: { connectionId_externalId: { connectionId: connection.id, externalId: slug } },
      create: {
        connectionId: connection.id,
        externalId: slug,
        name: parsed.projectName ?? slug,
        kind: 'sentry-project',
        metadata: {},
      },
      update: { name: parsed.projectName ?? slug },
    });

    const type = `sentry_issue:${parsed.issueId}`;
    const open = await prisma.incident.findFirst({
      where: { resourceId: resource.id, type, resolvedAt: null },
    });

    // Resolved/ignored in Sentry → resolve the Nexus incident (notify on the resolve).
    if (parsed.isResolved) {
      if (open) {
        await prisma.incident.update({ where: { id: open.id }, data: { resolvedAt: now } });
        await notifyResolvedIncidents([open.id]);
      }
      return NextResponse.json({ ok: true, resolved: Boolean(open) });
    }

    if (open) {
      // Sentry's count is authoritative when present; otherwise count this as one more
      // observation. Single update — no second round-trip.
      await prisma.incident.update({
        where: { id: open.id },
        data: {
          eventCount: parsed.count != null ? parsed.count : { increment: 1 },
          lastEventAt: now,
          message: parsed.title,
        },
      });
      return NextResponse.json({ ok: true, deduped: true, id: open.id });
    }

    // Guard against out-of-order delivery: if this exact issue was resolved very recently,
    // a delayed 'created' shouldn't re-open it. A genuine regression past the window opens.
    const recentlyResolved = await prisma.incident.findFirst({
      where: { resourceId: resource.id, type, resolvedAt: { gte: new Date(now.getTime() - RECENT_RESOLVE_MS) } },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true },
    });
    if (recentlyResolved) {
      log.info('sentry skip re-open of recently resolved issue', { connectionId: connection.id, type });
      return NextResponse.json({ ok: true, ignored: 'recently resolved' });
    }

    const incident = await prisma.incident.create({
      data: {
        resourceId: resource.id,
        type,
        severity: parsed.severity,
        message: parsed.title,
        eventCount: parsed.count ?? 1,
        lastEventAt: now,
        payload: {
          source: 'sentry',
          issueId: parsed.issueId,
          culprit: parsed.culprit,
          level: parsed.level,
          permalink: parsed.permalink,
        },
      },
    });
    try {
      const ctx = buildResourceContext(resource, 'open');
      for (const n of listNotifiers()) await n.notify(incident, ctx);
    } catch (e) {
      log.warn('sentry notify failed', { resourceId: resource.id, err: (e as Error).message });
    }
    return NextResponse.json({ ok: true, id: incident.id }, { status: 201 });
  } catch (e) {
    // 200 (not 5xx): the payload is auth'd + parsed; dropping it on a transient DB error is
    // safer than 5xx, which makes Sentry retry and can feed a pool-exhaustion loop.
    log.warn('sentry ingest failed', { connectionId: connection.id, err: (e as Error).message });
    return NextResponse.json({ ok: false, error: 'internal' });
  }
}
