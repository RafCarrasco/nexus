import cron from 'node-cron';
import { runAll } from './runAll';
import { runCost } from './runCost';
import { log } from '@/lib/logger';

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // Inventory + health every 5 minutes.
  cron.schedule('*/5 * * * *', () => {
    runAll().catch((e) => log.error('runAll failed', { err: (e as Error).message }));
  });

  // Cost + anomalies every 6 hours.
  cron.schedule('0 */6 * * *', () => {
    runCost().catch((e) => log.error('runCost failed', { err: (e as Error).message }));
  });

  log.info('scheduler started');
}
