import type { Incident } from '@prisma/client';

export type Status = 'ok' | 'warn' | 'crit';

export function aggregateStatus(incidents: Pick<Incident, 'severity' | 'resolvedAt'>[]): Status {
  const open = incidents.filter((i) => i.resolvedAt === null);
  if (open.some((i) => i.severity === 'crit')) return 'crit';
  if (open.length > 0) return 'warn';
  return 'ok';
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Tudo OK',
  warn: 'Atenção',
  crit: 'Crítico',
};

export const STATUS_COLOR: Record<Status, { dot: string; text: string; bg: string; ring: string }> = {
  ok:   { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  warn: { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200' },
  crit: { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200' },
};
