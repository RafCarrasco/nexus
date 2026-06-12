import { describe, it, expect } from 'vitest';
import { forecastCost } from '@/lib/forecast';

describe('forecastCost', () => {
  it('returns null for no data', () => {
    expect(forecastCost([])).toBeNull();
  });

  it('projects flat cost from constant history', () => {
    const points = Array.from({ length: 7 }, (_, i) => ({ date: `2026-06-0${i + 1}`, amount: 10 }));
    const f = forecastCost(points, 30)!;
    expect(f.trend).toBe('flat');
    expect(f.avgDailyRecent).toBe(10);
    expect(f.projectedTotal).toBeCloseTo(300); // 10/day * 30
    expect(f.basisDays).toBe(7);
  });

  it('detects an upward trend and projects more', () => {
    const points = [1, 2, 3, 4, 5].map((v, i) => ({ date: `2026-06-0${i + 1}`, amount: v }));
    const f = forecastCost(points, 10)!;
    expect(f.trend).toBe('up');
    expect(f.slopePerDay).toBeCloseTo(1);
    // next 10 days continue the line (x=5..14 => 6..15), sum = 105
    expect(f.projectedTotal).toBeCloseTo(105);
  });

  it('clamps projected daily cost at 0 on a steep downward trend', () => {
    const points = [10, 8, 6, 4, 2].map((v, i) => ({ date: `2026-06-0${i + 1}`, amount: v }));
    const f = forecastCost(points, 30)!;
    expect(f.trend).toBe('down');
    expect(f.projectedTotal).toBeGreaterThanOrEqual(0);
  });

  it('handles a single data point as flat', () => {
    const f = forecastCost([{ date: '2026-06-01', amount: 5 }], 30)!;
    expect(f.trend).toBe('flat');
    expect(f.projectedTotal).toBeCloseTo(150);
  });

  it('is order-independent (sorts by date)', () => {
    const a = forecastCost([{ date: '2026-06-03', amount: 3 }, { date: '2026-06-01', amount: 1 }, { date: '2026-06-02', amount: 2 }], 3)!;
    expect(a.trend).toBe('up');
    expect(a.slopePerDay).toBeCloseTo(1);
  });
});
