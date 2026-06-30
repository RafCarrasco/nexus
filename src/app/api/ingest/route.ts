import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, Resource } from '@prisma/client';
import { prisma } from '@/db/client';
import { assertIngestToken } from '@/auth/ingest-guard';
import { listNotifiers } from '@/notify/registry';
import { buildResourceContext } from '@/notify/context';
import { bumpIncident } from '@/collector/incident-bump';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public ingest endpoint: lets n8n flows / external scripts PUSH cost, metric and
 * incident data into Nexus (the inverse of the collector's pull model). Auth is a
 * per-connection bearer token (see assertIngestToken). The body is parsed ONCE so the
 * guard can read connectionId from it before any DB write.
 */

const costSchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().datetime()),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8).optional(),
  source: z.string().min(1).max(64).optional(),
  breakdown: z.unknown().optional(),
});

const metricSchema = z.object({
  name: z.string().min(1).max(120),
  value: z.number().finite(),
  unit: z.string().max(32).optional(),
  timestamp: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  metadata: z.unknown().optional(),
});

const incidentSchema = z.object({
  type: z.string().min(1).max(64),
  severity: z.enum(['warn', 'crit']),
  message: z.string().min(1).max(2000),
});

const bodySchema = z.object({
  kind: z.enum(['cost', 'metric', 'incident']),
  connectionId: z.string().min(1),
  resourceExternalId: z.string().min(1).optional(),
  payload: z.unknown(),
});

export async function POST(req: Request) {
  // Parse the envelope once — the guard needs connectionId before touching the DB.
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new NextResponse('invalid JSON body', { status: 400 });
  }
  const env = bodySchema.safeParse(json);
  if (!env.success) return new NextResponse(env.error.message, { status: 400 });
  const { kind, connectionId, resourceExternalId, payload } = env.data;

  const gate = await assertIngestToken(req, { connectionId });
  if (gate.response) return gate.response;
  const { connection } = gate;

  // All three kinds target a Resource, addressed by its externalId within the connection.
  if (!resourceExternalId) {
    return new NextResponse('resourceExternalId is required', { status: 400 });
  }
  const resource = await prisma.resource.findUnique({
    where: { connectionId_externalId: { connectionId: connection.id, externalId: resourceExternalId } },
  });
  if (!resource) return new NextResponse('resource not found', { status: 404 });

  try {
    if (kind === 'cost') return await ingestCost(resource, payload);
    if (kind === 'metric') return await ingestMetric(resource, payload);
    return await ingestIncident(resource, payload);
  } catch (e) {
    // Never leak the token; log only the resource + kind.
    log.warn('ingest failed', { kind, resourceId: resource.id, err: (e as Error).message });
    return new NextResponse('ingest failed', { status: 500 });
  }
}

async function ingestCost(resource: Resource, payload: unknown): Promise<NextResponse> {
  const p = costSchema.safeParse(payload);
  if (!p.success) return new NextResponse(p.error.message, { status: 400 });
  const date = new Date(p.data.date);
  if (Number.isNaN(date.getTime())) return new NextResponse('invalid date', { status: 400 });
  const source = p.data.source ?? 'ingest';

  const row = await prisma.costSnapshot.upsert({
    where: { resourceId_date_source: { resourceId: resource.id, date, source } },
    create: {
      resourceId: resource.id,
      date,
      amount: p.data.amount.toString(),
      currency: p.data.currency ?? 'USD',
      source,
      breakdown: (p.data.breakdown ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      amount: p.data.amount.toString(),
      currency: p.data.currency ?? 'USD',
      breakdown: (p.data.breakdown ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: row.id, kind: 'cost' }, { status: 201 });
}

async function ingestMetric(resource: Resource, payload: unknown): Promise<NextResponse> {
  const p = metricSchema.safeParse(payload);
  if (!p.success) return new NextResponse(p.error.message, { status: 400 });
  const timestamp = p.data.timestamp ? new Date(p.data.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) return new NextResponse('invalid timestamp', { status: 400 });

  const row = await prisma.metric.upsert({
    where: { resourceId_name_timestamp: { resourceId: resource.id, name: p.data.name, timestamp } },
    create: {
      resourceId: resource.id,
      name: p.data.name,
      value: p.data.value.toString(),
      unit: p.data.unit ?? '',
      timestamp,
      metadata: (p.data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      value: p.data.value.toString(),
      unit: p.data.unit ?? '',
      metadata: (p.data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: row.id, kind: 'metric' }, { status: 201 });
}

async function ingestIncident(resource: Resource, payload: unknown): Promise<NextResponse> {
  const p = incidentSchema.safeParse(payload);
  if (!p.success) return new NextResponse(p.error.message, { status: 400 });

  // Dedup like the collector's openIncidentOnce: one open incident per (resource, type).
  const existing = await prisma.incident.findFirst({
    where: { resourceId: resource.id, type: p.data.type, resolvedAt: null },
    select: { id: true },
  });
  if (existing) {
    await bumpIncident(existing.id);
    return NextResponse.json({ id: existing.id, kind: 'incident', deduped: true }, { status: 200 });
  }

  const incident = await prisma.incident.create({
    data: {
      resourceId: resource.id,
      type: p.data.type,
      severity: p.data.severity,
      message: p.data.message,
    },
  });
  const ctx = buildResourceContext(resource, 'open');
  try {
    for (const n of listNotifiers()) await n.notify(incident, ctx);
  } catch (e) {
    log.warn('notify failed', { resourceId: resource.id, type: p.data.type, err: (e as Error).message });
  }
  return NextResponse.json({ id: incident.id, kind: 'incident', deduped: false }, { status: 201 });
}
