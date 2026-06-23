/**
 * Pure helpers for the latency-trend degradation detector. A service that returns 200 OK
 * but is getting progressively slower is an early-warning signal of saturation/cascade —
 * we catch it BEFORE it crosses into a hard outage. The detector compares the p95 of recent
 * OK samples against the median of a longer baseline window; a sustained jump opens a
 * `performance_degraded` (warn) incident.
 */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile (p in 0..100) of an unsorted numeric array. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export type LatencyEval = {
  degraded: boolean;
  p95Recent: number | null;
  baseline: number | null;
};

/**
 * Decide whether recent latency is degraded vs baseline. Guards against noise:
 * - needs a minimum number of samples in each window (else returns not-degraded),
 * - requires the recent p95 to clear an absolute floor (so a 40ms→70ms jump on a fast
 *   endpoint never trips), AND exceed baseline median × factor.
 */
export function evaluateLatencyDegradation(
  recentMs: number[],
  baselineMs: number[],
  opts: { factor?: number; floorMs?: number; minRecent?: number; minBaseline?: number } = {},
): LatencyEval {
  const factor = opts.factor ?? 1.3;
  const floorMs = opts.floorMs ?? 800;
  const minRecent = opts.minRecent ?? 3;
  const minBaseline = opts.minBaseline ?? 20;

  if (recentMs.length < minRecent || baselineMs.length < minBaseline) {
    return { degraded: false, p95Recent: percentile(recentMs, 95), baseline: median(baselineMs) };
  }
  const baseline = median(baselineMs);
  const p95Recent = percentile(recentMs, 95);
  if (baseline == null || p95Recent == null) return { degraded: false, p95Recent, baseline };
  const degraded = p95Recent > floorMs && p95Recent > baseline * factor;
  return { degraded, p95Recent, baseline };
}
