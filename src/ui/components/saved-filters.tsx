'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Trash2, Check, Plus } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { saveFilter, deleteFilter } from '@/app/(dash)/saved-filters/actions';
import { sanitizeQuery, queryToSearchString, type SavedFilterPage } from '@/lib/saved-filters';

export type SavedFilterEntry = {
  id: string;
  name: string;
  query: Record<string, string>;
};

/**
 * Per-user saved-filter dropdown. Filters are passed in from the server (no
 * localStorage, SSR-safe). Applying a filter pushes the page with the encoded
 * query; saving reads the live URL search string (client-only). The entry whose
 * query matches the current searchParams is highlighted.
 */
export function SavedFilters({ page, filters }: { page: SavedFilterPage; filters: SavedFilterEntry[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Current URL query, sanitized to the page's allow-list, for matching/highlight.
  const current = sanitizeQuery(page, Object.fromEntries(searchParams.entries()));
  const currentKey = queryToSearchString(current);

  function apply(query: Record<string, string>) {
    setOpen(false);
    const qs = queryToSearchString(query);
    router.push(`/${page}${qs ? `?${qs}` : ''}` as never);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Read the live URL search string — client-only, only inside this handler.
    const raw = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    const query = sanitizeQuery(page, raw);
    const fd = new FormData();
    fd.set('page', page);
    fd.set('name', trimmed);
    fd.set('query', JSON.stringify(query));
    start(async () => {
      await saveFilter(fd);
      setName('');
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('page', page);
    start(async () => {
      await deleteFilter(fd);
      router.refresh();
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="gap-2">
        <Filter className="h-4 w-4" />
        Filtros salvos
        {filters.length > 0 && <span className="text-zinc-400">({filters.length})</span>}
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="max-h-64 overflow-y-auto py-1">
            {filters.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">
                Nenhum filtro salvo — ajuste os filtros e salve.
              </p>
            ) : (
              filters.map((f) => {
                const isActive = queryToSearchString(f.query) === currentKey;
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      isActive ? 'bg-violet-50 dark:bg-violet-950/30' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => apply(f.query)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          isActive
                            ? 'font-medium text-violet-700 dark:text-violet-300'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {f.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      disabled={pending}
                      aria-label={`Excluir ${f.name}`}
                      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Salvar filtro atual…"
              maxLength={60}
              className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={pending || !name.trim()}
              aria-label="Salvar filtro atual"
              className="shrink-0 gap-1"
            >
              <Plus className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
