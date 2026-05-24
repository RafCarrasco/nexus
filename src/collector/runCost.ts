import { prisma } from '@/db/client';
import { getProvider } from '@/providers/registry';
import { decrypt } from '@/crypto/vault';
import { yesterdayUtc } from '@/lib/dates';
import { detectCostSpikes } from './anomaly';
import { log } from '@/lib/logger';
import type { CostDTO } from '@/providers/types';

/**
 * Cap external cost-API calls to 1 per (resource, day) per day.
 * Firebase can produce either 'bigquery' or 'cloud-monitoring' as source depending on config,
 * so we check for either. Supabase always uses 'supabase-billing'.
 */
const EXPECTED_SOURCE_PER_TYPE: Record<string, string> = {
  supabase: 'supabase-billing',
};

// Firebase may use either source — check for any existing snapshot from either.
const FIREBASE_SOURCES = ['bigquery', 'cloud-monitoring'];

export async function runCost(now = new Date()): Promise<void> {
  const date = yesterdayUtc(now);
  const connections = await prisma.connection.findMany({ where: { status: 'active' } });
  log.info('collector.runCost start', { count: connections.length, date: date.toISOString() });
  let calls = 0;
  let saved = 0;
  let nulls = 0;
  for (const conn of connections) {
    let provider;
    try {
      provider = getProvider(conn.type);
    } catch {
      continue;
    }
    const expectedSource = EXPECTED_SOURCE_PER_TYPE[conn.type];
    const view = { id: conn.id, type: conn.type, config: decrypt<Record<string, unknown>>(Buffer.from(conn.credentials)) };
    const resources = await prisma.resource.findMany({ where: { connectionId: conn.id } });
    for (const r of resources) {
      // Cap: skip if snapshot already exists for this resource+date.
      if (conn.type === 'firebase') {
        const existing = await prisma.costSnapshot.findFirst({
          where: { resourceId: r.id, date, source: { in: FIREBASE_SOURCES } },
        });
        if (existing) {
          log.info('cost.cap skip (snapshot exists)', {
            connectionId: conn.id,
            resourceId: r.id,
            externalId: r.externalId,
            source: existing.source,
          });
          continue;
        }
      } else if (expectedSource) {
        const existing = await prisma.costSnapshot.findUnique({
          where: { resourceId_date_source: { resourceId: r.id, date, source: expectedSource } },
        });
        if (existing) {
          log.info('cost.cap skip (snapshot exists)', {
            connectionId: conn.id,
            resourceId: r.id,
            externalId: r.externalId,
            source: expectedSource,
          });
          continue;
        }
      }
      try {
        calls++;
        log.info('cost.call', { connectionType: conn.type, resourceId: r.id, externalId: r.externalId });
        const cost = await provider.getDailyCost(view, r.externalId, date);
        if (!cost) {
          nulls++;
          log.info('cost.null', { connectionType: conn.type, resourceId: r.id, externalId: r.externalId });
          continue;
        }
        const breakdown = (cost as CostDTO & { breakdown?: unknown }).breakdown ?? undefined;
        await prisma.costSnapshot.upsert({
          where: { resourceId_date_source: { resourceId: r.id, date, source: cost.source } },
          create: {
            resourceId: r.id, date,
            amount: cost.amount, currency: cost.currency, source: cost.source,
            breakdown: breakdown as never,
          },
          update: {
            amount: cost.amount, currency: cost.currency,
            breakdown: breakdown as never,
          },
        });
        saved++;
        log.info('cost.saved', { resourceId: r.id, amount: cost.amount, currency: cost.currency, source: cost.source });
      } catch (e) {
        log.warn('cost failed', { connectionId: conn.id, resourceId: r.id, err: (e as Error).message });
      }
    }
  }
  log.info('collector.runCost done', { calls, saved, nulls });
  await detectCostSpikes(date);
}
