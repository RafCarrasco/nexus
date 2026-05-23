/** Returns the UTC date for the day BEFORE the given moment, at midnight UTC. */
export function yesterdayUtc(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/** Returns the UTC date for `daysBack` days before `from`, at midnight UTC. */
export function daysBackUtc(from: Date, daysBack: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}
