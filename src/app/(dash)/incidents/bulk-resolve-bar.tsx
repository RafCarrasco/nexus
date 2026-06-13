'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { ResolveButton } from './resolve-button';
import { bulkResolveIncidents } from './actions';

export type OpenRow = {
  id: string;
  openedAt: string;
  name: string;
  href: string;
  type: string;
  severity: string;
  message: string;
};

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
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-violet-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-violet-950/30">
          <span className="text-sm text-violet-700 dark:text-violet-300">
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={resolveSelected} disabled={pending}>
            {pending ? 'Resolvendo…' : `Resolver selecionados (${selected.size})`}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
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
            </TableHead>
            <TableHead>Aberto em</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Severidade</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {open.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                  aria-label={`Selecionar ${i.name}`}
                />
              </TableCell>
              <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">{i.openedAt}</TableCell>
              <TableCell>
                <Link href={i.href as never} className="font-medium text-zinc-900 transition-colors hover:text-violet-600 dark:text-zinc-100">
                  {i.name}
                </Link>
              </TableCell>
              <TableCell className="text-zinc-500 dark:text-zinc-400">{i.type}</TableCell>
              <TableCell>
                <Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge>
              </TableCell>
              <TableCell className="max-w-[420px] truncate text-zinc-600 dark:text-zinc-400">{i.message}</TableCell>
              <TableCell>
                <ResolveButton id={i.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
