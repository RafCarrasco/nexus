import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { PageHeader } from '@/ui/components/page-header';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { SavedFilters, type SavedFilterEntry } from '@/ui/components/saved-filters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';

type Search = { client?: string; type?: string; q?: string };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const savedFilters = userId
    ? await prisma.savedFilter.findMany({
        where: { userId, page: 'resources' },
        orderBy: { name: 'asc' },
      })
    : [];
  const filterEntries: SavedFilterEntry[] = savedFilters.map((f) => ({
    id: f.id,
    name: f.name,
    query: (f.query ?? {}) as Record<string, string>,
  }));
  const rows = await prisma.resource.findMany({
    where: {
      ...(sp.client ? { clientId: sp.client } : {}),
      ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: 'insensitive' } }, { externalId: { contains: sp.q, mode: 'insensitive' } }] } : {}),
      ...(sp.type ? { connection: { type: sp.type } } : {}),
    },
    include: { connection: true, activityLog: true, _count: { select: { incidents: { where: { resolvedAt: null } } } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Recursos (todos os aplicativos)" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400 -mt-4">
        Visão global. Para ver recursos por aplicativo, acesse{' '}
        <Link href="/workspaces" className="text-violet-600 hover:underline">Aplicativos →</Link>
      </p>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-2">
        <form className="flex items-center gap-2 text-sm">
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="buscar…"
            className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white dark:bg-zinc-900"
          />
          <select
            name="type"
            defaultValue={sp.type ?? ''}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white dark:bg-zinc-900"
          >
            <option value="">todos os tipos</option>
            <option value="firebase">firebase</option>
            <option value="supabase">supabase</option>
            <option value="docker">docker</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Filtrar
          </button>
        </form>
        <SavedFilters page="resources" filters={filterEntries} />
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4 shadow-sm">
          <Boxes className="h-10 w-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Nenhum recurso descoberto</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Adicione uma conexão num aplicativo para começar a descobrir recursos automaticamente.
          </p>
          <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
            <Link href="/workspaces">Ir para Aplicativos</Link>
          </Button>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead>Incidentes abertos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/resources/${r.id}` as never} className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-violet-600 transition-colors">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">{r.kind}</TableCell>
                <TableCell><Badge variant="outline">{r.connection.type}</Badge></TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">{r.region ?? '—'}</TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">
                  {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
                </TableCell>
                <TableCell>
                  {r._count.incidents > 0
                    ? <Badge variant="destructive">{r._count.incidents}</Badge>
                    : <span className="text-zinc-400">0</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
