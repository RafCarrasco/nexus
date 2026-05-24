import { prisma } from '@/db/client';
import { getProvider } from '@/providers/registry';
import { decrypt } from '@/crypto/vault';
import { yesterdayUtc } from '@/lib/dates';
import { detectCostSpikes } from './anomaly';
import { log } from '@/lib/logger';

/**
 * Cap external cost-API calls to 1 per (resource, day, expected source) per day.
 * If we already have a snapshot for that key, we skip the API call entirely.
 * For Cloud Monitoring (Firebase) this guarantees we stay well under the 1M
 * reads/month free tier regardless of how often `runCost` is triggered.
 */
const EXPECTED_SOURCE_PER_TYPE: Record<string, string> = {
  firebase: 'cloud-monitoring',
  supabase: 'supabase-billing',
};

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
      // Cap: if we already pulled a snapshot for this resource+date+source today, skip.
      if (expectedSource) {
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
        await prisma.costSnapshot.upsert({
          where: { resourceId_date_source: { resourceId: r.id, date, source: cost.source } },
          create: { resourceId: r.id, date, amount: cost.amount, currency: cost.currency, source: cost.source },
          update: { amount: cost.amount, currency: cost.currency },
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
