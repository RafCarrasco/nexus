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

/**
 * Formats an arbitrary date-ish value (ISO string / epoch ms / Date) as "YYYY-MM-DD HH:mm"
 * in UTC, matching the slice convention used elsewhere in the UI. Returns null for invalid
 * or absent input so callers can simply skip rendering.
 */
export function formatDeployTimestamp(value: unknown): string | null {
  if (value == null || (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date))) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Short pt-BR relative hint ("agora", "há 3 h", "há 5 dias") for a date-ish value,
 * relative to `now`. Returns null for invalid/absent input. Best-effort, coarse buckets.
 */
export function relativeDeployHint(value: unknown, now: Date = new Date()): string | null {
  if (value == null || (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date))) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}
