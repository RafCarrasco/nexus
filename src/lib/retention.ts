/**
 * Pure cutoff helper for the retention job. Kept separate so the date math is unit-testable
 * without a DB.
 */
export function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * Retention windows (days). UptimeSample is the highest-volume table (one row per check per
 * tick) and only needs ~7 days for the latency baseline — keep 14 for margin. Metrics keep
 * 90 days; cost snapshots keep 2 years (low volume, useful history).
 */
export const RETENTION_DAYS = {
  uptimeSample: 14,
  metric: 90,
  costSnapshot: 730,
} as const;
