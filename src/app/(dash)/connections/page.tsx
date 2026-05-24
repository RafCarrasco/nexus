import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Button } from '@/ui/components/button';
import { RunNow } from './run-now';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace: workspaceSlug } = await searchParams;

  const workspaceFilter = workspaceSlug
    ? { workspace: { slug: workspaceSlug } }
    : undefined;

  const rows = await prisma.connection.findMany({
    where: workspaceFilter,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, type: true, status: true,
      lastError: true, lastCollectedAt: true,
      workspace: { select: { id: true, slug: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspaceSlug ? `Conexões — ${rows[0]?.workspace?.name ?? workspaceSlug}` : 'Conexões'}
        action={
          <>
            <RunNow />
            <Button asChild><Link href="/connections/new">Nova conexão</Link></Button>
          </>
        }
      />
      {workspaceSlug && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span>Filtrando por aplicativo:</span>
          <Badge variant="outline">{workspaceSlug}</Badge>
          <Link href="/connections" className="text-violet-600 hover:underline text-xs">
            Limpar filtro
          </Link>
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Aplicativo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última coleta</TableHead>
              <TableHead>Último erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-zinc-500 py-6">
                  Nenhuma conexão encontrada.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/connections/${c.id}` as never} className="font-medium text-zinc-900 hover:text-violet-600 transition-colors">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell>
                  {c.workspace ? (
                    <Link href={`/workspaces/${c.workspace.slug}` as never} className="text-xs text-violet-600 hover:underline">
                      {c.workspace.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'active' : 'destructive'}>{c.status}</Badge>
                </TableCell>
                <TableCell className="text-zinc-500">
                  {c.lastCollectedAt ? c.lastCollectedAt.toISOString().slice(0, 19).replace('T', ' ') : '—'}
                </TableCell>
                <TableCell className="max-w-[400px] truncate text-xs text-zinc-400">
                  {c.lastError ?? ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
