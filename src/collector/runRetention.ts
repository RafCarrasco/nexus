import { prisma } from '@/db/client';
import { log } from '@/lib/logger';
import { cutoff, RETENTION_DAYS } from '@/lib/retention';

/**
 * Prune time-series tables that otherwise grow unbounded — chiefly UptimeSample (one row
 * per check per tick). Runs daily. Deletes are bounded by date so a stuck job can't wipe
 * recent data. Logs how many rows each table shed.
 */
export async function runRetention(now: Date = new Date()): Promise<void> {
  try {
    const samples = await prisma.uptimeSample.deleteMany({
      where: { at: { lt: cutoff(now, RETENTION_DAYS.uptimeSample) } },
    });
    const metrics = await prisma.metric.deleteMany({
      where: { timestamp: { lt: cutoff(now, RETENTION_DAYS.metric) } },
    });
    const costs = await prisma.costSnapshot.deleteMany({
      where: { date: { lt: cutoff(now, RETENTION_DAYS.costSnapshot) } },
    });
    log.info('retention done', {
      uptimeSamples: samples.count,
      metrics: metrics.count,
      costSnapshots: costs.count,
    });
  } catch (e) {
    log.error('retention failed', { err: (e as Error).message });
  }
}
