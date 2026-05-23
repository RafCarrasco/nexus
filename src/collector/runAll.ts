import { prisma } from '@/db/client';
import { runCollection } from './runCollection';
import { log } from '@/lib/logger';

export async function runAll(): Promise<void> {
  const conns = await prisma.connection.findMany({ where: { status: { not: 'paused' } } });
  log.info('collector.runAll start', { count: conns.length });
  for (const c of conns) {
    await runCollection(c.id);
  }
  log.info('collector.runAll done');
}
