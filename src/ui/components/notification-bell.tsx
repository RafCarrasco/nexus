'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

type OpenIncident = {
  id: string;
  type: string;
  severity: string;
  message: string;
  openedAt: string;
  name: string;
};

const POLL_MS = 60_000;

/** crit → rose dot, warn → amber dot, else zinc dot. */
function severityDot(severity: string): string {
  if (severity === 'crit') return 'bg-rose-500';
  if (severity === 'warn') return 'bg-amber-500';
  return 'bg-zinc-400';
}

/** Compact pt-BR relative time, e.g. 'há 3m', 'há 2h', 'há 5d'. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const day = Math.floor(hr / 24);
  return `há ${day}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [incidents, setIncidents] = useState<OpenIncident[]>([]);
  const [total, setTotal] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents/open', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { incidents?: OpenIncident[]; total?: number };
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      // Best-effort: a failed poll must never break the header.
    }
  }, []);

  // Poll on mount + every POLL_MS. The initial fetch is scheduled async (not a
  // synchronous setState in the effect body) and load() never sets state before
  // the awaited fetch resolves, so no cascading renders.
  useEffect(() => {
    const kick = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const badgeCount = total > 99 ? '99+' : String(total);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={total > 0 ? `${total} incidente(s) aberto(s)` : 'Notificações'}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Incidentes abertos</span>
            {total > 0 && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {total}
              </span>
            )}
          </div>

          {incidents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Nenhum incidente aberto
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-zinc-100 overflow-auto dark:divide-zinc-800">
              {incidents.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/incidents/${i.id}` as never}
                    onClick={() => setOpen(false)}
                    className="flex gap-2.5 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot(i.severity)}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{i.name}</span>
                        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                          {relativeTime(i.openedAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{i.message}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/incidents"
            onClick={() => setOpen(false)}
            className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-violet-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-violet-400 dark:hover:bg-zinc-800/60"
          >
            Ver todos
          </Link>
        </div>
      )}
    </div>
  );
}
