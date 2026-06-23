import { describe, it, expect } from 'vitest';
import { median, percentile, evaluateLatencyDegradation } from '@/lib/latency-trend';

describe('median / percentile', () => {
  it('computes median for odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('computes nearest-rank percentile', () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile([], 95)).toBeNull();
  });
});

describe('evaluateLatencyDegradation', () => {
  const baseline = Array.from({ length: 40 }, () => 100); // stable 100ms baseline

  it('flags degradation when recent p95 jumps well above baseline', () => {
    const recent = [1500, 1600, 1700, 1800]; // ~15x baseline, above floor
    const res = evaluateLatencyDegradation(recent, baseline);
    expect(res.degraded).toBe(true);
    expect(res.baseline).toBe(100);
  });

  it('does not flag when recent is near baseline', () => {
    const recent = [110, 120, 105, 115];
    expect(evaluateLatencyDegradation(recent, baseline).degraded).toBe(false);
  });

  it('respects the absolute floor — small jump on a fast endpoint is not degraded', () => {
    // 40ms baseline, recent ~120ms: 3x ratio but under the 800ms floor → not degraded.
    const fastBaseline = Array.from({ length: 40 }, () => 40);
    const recent = [120, 130, 110, 125];
    expect(evaluateLatencyDegradation(recent, fastBaseline).degraded).toBe(false);
  });

  it('returns not-degraded when there are too few samples', () => {
    expect(evaluateLatencyDegradation([5000], baseline).degraded).toBe(false); // recent < minRecent
    expect(evaluateLatencyDegradation([1500, 1600, 1700], [100, 100]).degraded).toBe(false); // baseline < minBaseline
  });
});
