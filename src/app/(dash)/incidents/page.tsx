import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { ResolveButton } from './resolve-button';

export default async function IncidentsPage() {
  const open = await prisma.incident.findMany({
    where: { resolvedAt: null },
    orderBy: { openedAt: 'desc' },
    include: { resource: { include: { connection: true } }, uptimeCheck: true },
  });
  const recent = await prisma.incident.findMany({
    where: { resolvedAt: { not: null } },
    orderBy: { resolvedAt: 'desc' },
    take: 50,
    include: { resource: true, uptimeCheck: true },
  });
  if (open.length === 0 && recent.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Incidentes" />
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4 shadow-sm">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Tudo tranquilo por aqui</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Nenhum incidente aberto ou resolvido. Quando algo precisar de atenção, vai aparecer aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Incidentes"
        subtitle={open.length > 0 ? `${open.length} incidente${open.length !== 1 ? 's' : ''} aberto${open.length !== 1 ? 's' : ''}` : undefined}
      />

      {/* Open incidents */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Abertos <span className="text-zinc-400 font-normal">({open.length})</span>
        </h2>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aberto em</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400 py-8">
                    Sem incidentes.
                  </TableCell>
                </TableRow>
              )}
              {open.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
                    {i.openedAt.toISOString().slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell>
                    {i.resource ? (
                      <Link href={`/resources/${i.resourceId}` as never} className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-violet-600 transition-colors">
                        {i.resource.name}
                      </Link>
                    ) : (
                      <Link href={'/uptime' as never} className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-violet-600 transition-colors">
                        {i.uptimeCheck?.name ?? '—'}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">{i.type}</TableCell>
                  <TableCell>
                    <Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-zinc-600 dark:text-zinc-400">{i.message}</TableCell>
                  <TableCell><ResolveButton id={i.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Recently resolved */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Resolvidos recentemente</h2>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resolvido</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-400 py-8">
                    Sem incidentes.
                  </TableCell>
                </TableRow>
              )}
              {recent.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
                    {i.resolvedAt!.toISOString().slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{i.resource?.name ?? i.uptimeCheck?.name ?? '—'}</TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">{i.type}</TableCell>
                  <TableCell className="max-w-[420px] truncate text-zinc-600 dark:text-zinc-400">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
