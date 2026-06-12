export type CostPoint = { date: Date | string; amount: number };

export type Forecast = {
  projectedTotal: number; // sum of projected daily cost over the next `days`
  avgDailyRecent: number; // mean of observed daily amounts
  slopePerDay: number; // regression slope (cost change per day)
  trend: 'up' | 'down' | 'flat';
  basisDays: number; // observed points used
  days: number; // horizon
};

/**
 * Project cost over the next `days` from observed daily cost snapshots using simple
 * least-squares linear regression on daily amounts. Projected daily values are clamped
 * at 0 (cost can't go negative). Returns null when there's no data.
 */
export function forecastCost(points: CostPoint[], days = 30): Forecast | null {
  if (!points.length) return null;

  const ys = [...points]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((p) => p.amount);
  const n = ys.length;
  const avgDailyRecent = ys.reduce((s, v) => s + v, 0) / n;

  if (n === 1) {
    return { projectedTotal: avgDailyRecent * days, avgDailyRecent, slopePerDay: 0, trend: 'flat', basisDays: 1, days };
  }

  const meanX = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - avgDailyRecent);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = avgDailyRecent - slope * meanX;

  let projectedTotal = 0;
  for (let i = n; i < n + days; i++) projectedTotal += Math.max(0, intercept + slope * i);

  const trend = Math.abs(slope) < 1e-9 ? 'flat' : slope > 0 ? 'up' : 'down';
  return { projectedTotal, avgDailyRecent, slopePerDay: slope, trend, basisDays: n, days };
}
