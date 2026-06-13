import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { Badge } from '@/ui/components/badge';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Registro de auditoria" />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhuma ação registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                    {e.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell className="text-sm">{e.user?.name ?? e.user?.email ?? e.userId}</TableCell>
                  <TableCell>
                    <Badge variant="violet">{e.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
