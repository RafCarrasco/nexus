import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { Badge } from '@/ui/components/badge';
import { enrichAuditEntries } from '@/lib/audit-enrichment';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  const enriched = await enrichAuditEntries(entries.map((e) => ({ id: e.id, action: e.action, target: e.target })));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de auditoria"
        subtitle="Quem fez o quê — cada ação de escrita (criar, editar, remover, rodar coleta) fica registrada aqui"
      />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma ação registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alvo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const info = enriched.get(e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                      {e.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                    </TableCell>
                    <TableCell className="text-sm">{e.user?.name ?? e.user?.email ?? e.userId}</TableCell>
                    <TableCell>
                      <Badge variant="violet">{info?.actionLabel ?? e.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">{info?.entityLabel ?? '—'}</TableCell>
                    <TableCell
                      className={
                        info?.resolved
                          ? 'max-w-[320px] truncate text-sm text-zinc-700 dark:text-zinc-300'
                          : 'max-w-[320px] truncate font-mono text-xs text-zinc-400 dark:text-zinc-500'
                      }
                      title={info?.resolved ? undefined : 'referência não encontrada (entidade removida)'}
                    >
                      {info?.targetName ?? e.target}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
