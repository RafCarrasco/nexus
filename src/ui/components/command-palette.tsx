'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowRight,
  Box,
  Plug,
  AppWindow,
  User,
  AlertCircle,
  Plus,
  Play,
  TrendingUp,
} from 'lucide-react';

type Result = { type: string; id: string; label: string; sub?: string; href: string };
type QuickAction = {
  id: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
};

type Item =
  | ({ kind: 'result' } & Result)
  | ({ kind: 'action' } & QuickAction);

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions: QuickAction[] = [
    { id: 'new-workspace', label: 'Novo aplicativo', href: '/workspaces/new', icon: Plus },
    {
      id: 'run',
      label: 'Rodar coletor agora',
      icon: Play,
      onSelect: async () => {
        await fetch('/api/collector/run', { method: 'POST' });
      },
    },
    { id: 'cost', label: 'Ver custo', href: '/cost', icon: TrendingUp },
    { id: 'incidents', label: 'Ver incidentes', href: '/incidents', icon: AlertCircle },
  ];

  // Open with Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => {
        setQ('');
        setResults([]);
        setHighlight(0);
      }, 0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!q.trim()) {
      setTimeout(() => setResults([]), 0);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setHighlight(0);
      } catch {
        // ignore
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const items: Item[] = q.trim()
    ? results.map((r) => ({ kind: 'result' as const, ...r }))
    : quickActions.map((a) => ({ kind: 'action' as const, ...a }));

  function select(idx: number) {
    const item = items[idx];
    if (!item) return;
    setOpen(false);
    if (item.kind === 'result') {
      router.push(item.href as never);
    } else if (item.href) {
      router.push(item.href as never);
    } else if (item.onSelect) {
      void item.onSelect();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24 bg-black/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => Math.min(items.length - 1, h + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                select(highlight);
              }
            }}
            placeholder="Buscar aplicativos, conexões, recursos…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          <kbd className="text-[10px] text-zinc-400 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="text-center text-sm text-zinc-500 py-8">
              {q.trim() ? 'Nada encontrado.' : 'Comece a digitar pra buscar.'}
            </div>
          )}
          {items.map((item, i) => {
            const isHighlighted = i === highlight;
            const Icon: React.ComponentType<{ className?: string }> =
              item.kind === 'result' ? iconForType(item.type) : item.icon;
            const key =
              item.kind === 'result'
                ? `result-${item.id}-${i}`
                : `action-${item.id}-${i}`;
            return (
              <button
                key={key}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(i)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isHighlighted ? 'bg-violet-50' : 'hover:bg-zinc-50'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isHighlighted ? 'text-violet-600' : 'text-zinc-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {item.label}
                  </div>
                  {'sub' in item && item.sub && (
                    <div className="text-xs text-zinc-500 truncate">{item.sub}</div>
                  )}
                </div>
                <ArrowRight
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isHighlighted ? 'text-violet-600' : 'text-zinc-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-zinc-100 px-4 py-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>↑↓ navegar · ↵ selecionar</span>
          <span>
            Pressione{' '}
            <kbd className="bg-zinc-100 border border-zinc-200 rounded px-1 py-0.5 mx-0.5">
              Ctrl
            </kbd>
            +
            <kbd className="bg-zinc-100 border border-zinc-200 rounded px-1 py-0.5 mx-0.5">
              K
            </kbd>{' '}
            em qualquer página
          </span>
        </div>
      </div>
    </div>
  );
}

function iconForType(type: string): React.ComponentType<{ className?: string }> {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    workspace: AppWindow,
    connection: Plug,
    resource: Box,
    client: User,
    incident: AlertCircle,
  };
  return map[type] ?? Box;
}
