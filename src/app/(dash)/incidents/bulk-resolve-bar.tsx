'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bug, Activity, Timer, TrendingUp, Bot, Gauge, HeartPulse } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { ResolveButton } from './resolve-button';
import { bulkResolveIncidents } from './actions';
import type { IncidentSourceKind } from '@/lib/incident-source';

export type OpenRow = {
  id: string;
  severity: string;
  type: string;
  message: string;
  href: string;
  appName: string;
  sourceKind: IncidentSourceKind;
  sourceLabel: string;
  eventCount: number;
  lastEventRel: string;
};

const SOURCE_ICON: Record<IncidentSourceKind, React.ElementType> = {
  error: Bug,
  uptime: Activity,
  latency: Timer,
  cost: TrendingUp,
  ai: Bot,
  metric: Gauge,
  infra: HeartPulse,
};

function sevStyle(severity: string) {
  return severity === 'crit'
    ? { bar: 'bg-rose-500', icon: 'text-rose-500' }
    : { bar: 'bg-amber-500', icon: 'text-amber-500' };
}

const chipCls =
  'inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';

export function BulkResolveBar({ open }: { open: OpenRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const allSelected = open.length > 0 && selected.size === open.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function resolveSelected() {
    const ids = [...selected];
    start(async () => {
      await bulkResolveIncidents(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-violet-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-violet-950/30">
          <span className="text-sm text-violet-700 dark:text-violet-300">
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={resolveSelected} disabled={pending}>
            {pending ? 'Resolvendo…' : `Resolver selecionados (${selected.size})`}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-400 dark:border-zinc-800">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selected.size > 0 && !allSelected;
            }}
            onChange={() => setSelected(allSelected ? new Set() : new Set(open.map((o) => o.id)))}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            aria-label="Selecionar todos"
          />
          <span className="flex-1">Incidente</span>
          <span className="w-16 text-right">Eventos</span>
          <span className="hidden w-24 text-right sm:block">Último</span>
          <span className="w-20" />
        </div>
      )}

      {open.map((row) => {
        const Icon = SOURCE_ICON[row.sourceKind] ?? HeartPulse;
        const s = sevStyle(row.severity);
        return (
          <div
            key={row.id}
            className="flex items-stretch border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/30"
          >
            <div className={`w-1 shrink-0 ${s.bar}`} />
            <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => toggle(row.id)}
                className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                aria-label={`Selecionar ${row.message}`}
              />
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <Link
                  href={row.href as never}
                  className="block truncate text-sm font-medium text-zinc-900 transition-colors hover:text-violet-600 dark:text-zinc-100 dark:hover:text-violet-400"
                >
                  {row.message}
                </Link>
                <div className="mt-0.5 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">{row.type}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={chipCls}>{row.appName}</span>
                  <span className={chipCls}>
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {row.sourceLabel}
                  </span>
                </div>
              </div>
              <div className="w-16 shrink-0 text-right">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100" title={`${row.eventCount} eventos`}>
                  {row.eventCount}
                </div>
              </div>
              <div className="hidden w-24 shrink-0 text-right text-xs text-zinc-400 sm:block">{row.lastEventRel}</div>
              <div className="w-20 shrink-0 text-right">
                <ResolveButton id={row.id} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
