import cron from 'node-cron';
import { runAll } from './runAll';
import { runCost } from './runCost';
import { runUptime } from './runUptime';
import { runAiProbes } from './runAiProbes';
import { runMetricEval } from './runMetricEval';
import { runRetention } from './runRetention';
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

  // Uptime checks every minute (each check self-gates on its own interval).
  cron.schedule('* * * * *', () => {
    runUptime().catch((e) => log.error('runUptime failed', { err: (e as Error).message }));
  });

  // AI quality probes every minute (each probe self-gates on its own interval).
  cron.schedule('* * * * *', () => {
    runAiProbes().catch((e) => log.error('runAiProbes failed', { err: (e as Error).message }));
  });

  // Metric threshold evaluation every 5 minutes (acts on metrics pushed via the ingest API).
  cron.schedule('*/5 * * * *', () => {
    runMetricEval().catch((e) => log.error('runMetricEval failed', { err: (e as Error).message }));
  });

  // Data retention: prune unbounded time-series tables daily at 02:00 UTC.
  cron.schedule('0 2 * * *', () => {
    runRetention().catch((e) => log.error('runRetention failed', { err: (e as Error).message }));
  });

  log.info('scheduler started');
}
