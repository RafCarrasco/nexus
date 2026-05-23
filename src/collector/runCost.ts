import { prisma } from '@/db/client';
import { getProvider } from '@/providers/registry';
import { decrypt } from '@/crypto/vault';
import { yesterdayUtc } from '@/lib/dates';
import { detectCostSpikes } from './anomaly';
import { log } from '@/lib/logger';

export async function runCost(now = new Date()): Promise<void> {
  const date = yesterdayUtc(now);
  const connections = await prisma.connection.findMany({ where: { status: 'active' } });
  for (const conn of connections) {
    let provider;
    try {
      provider = getProvider(conn.type);
    } catch {
      continue;
    }
    const view = { id: conn.id, type: conn.type, config: decrypt<Record<string, unknown>>(conn.credentials) };
    const resources = await prisma.resource.findMany({ where: { connectionId: conn.id } });
    for (const r of resources) {
      try {
        const cost = await provider.getDailyCost(view, r.externalId, date);
        if (!cost) continue;
        await prisma.costSnapshot.upsert({
          where: { resourceId_date_source: { resourceId: r.id, date, source: cost.source } },
          create: { resourceId: r.id, date, amount: cost.amount, currency: cost.currency, source: cost.source },
          update: { amount: cost.amount, currency: cost.currency },
        });
      } catch (e) {
        log.warn('cost failed', { connectionId: conn.id, resourceId: r.id, err: (e as Error).message });
      }
    }
  }
  await detectCostSpikes(date);
}
