import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { PageHeader } from '@/ui/components/page-header';
import { SavedFilters, type SavedFilterEntry } from '@/ui/components/saved-filters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { BulkResolveBar, type OpenRow } from './bulk-resolve-bar';

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; type?: string }>;
}) {
  const { severity, type } = await searchParams;
  // Defensive spread-if-present (never string-concat into a query).
  const incidentFilter = {
    ...(severity ? { severity } : {}),
    ...(type ? { type } : {}),
  };

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const savedFilters = userId
    ? await prisma.savedFilter.findMany({
        where: { userId, page: 'incidents' },
        orderBy: { name: 'asc' },
      })
    : [];
  const filterEntries: SavedFilterEntry[] = savedFilters.map((f) => ({
    id: f.id,
    name: f.name,
    query: (f.query ?? {}) as Record<string, string>,
  }));

  const open = await prisma.incident.findMany({
    where: { resolvedAt: null, ...incidentFilter },
    orderBy: { openedAt: 'desc' },
    include: { resource: { include: { connection: true } }, uptimeCheck: true, alertRule: true },
  });
  const recent = await prisma.incident.findMany({
    where: { resolvedAt: { not: null }, ...incidentFilter },
    orderBy: { resolvedAt: 'desc' },
    take: 50,
    include: { resource: true, uptimeCheck: true, alertRule: true },
  });
  const openRows: OpenRow[] = open.map((i) => ({
    id: i.id,
    openedAt: i.openedAt.toISOString().slice(0, 19).replace('T', ' '),
    name: i.resource?.name ?? i.uptimeCheck?.name ?? i.alertRule?.name ?? '—',
    href: i.resource ? `/resources/${i.resourceId}` : i.uptimeCheck ? '/uptime' : '/alerts',
    type: i.type,
    severity: i.severity,
    message: i.message,
  }));

  if (open.length === 0 && recent.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-2">
          <PageHeader title="Incidentes" />
          <SavedFilters page="incidents" filters={filterEntries} />
        </div>
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
      <div className="flex items-start justify-between gap-2">
        <PageHeader
          title="Incidentes"
          subtitle={open.length > 0 ? `${open.length} incidente${open.length !== 1 ? 's' : ''} aberto${open.length !== 1 ? 's' : ''}` : undefined}
        />
        <SavedFilters page="incidents" filters={filterEntries} />
      </div>

      {/* Open incidents */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Abertos <span className="text-zinc-400 font-normal">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-400 shadow-sm">
            Sem incidentes abertos.
          </div>
        ) : (
          <BulkResolveBar open={openRows} />
        )}
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
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{i.resource?.name ?? i.uptimeCheck?.name ?? i.alertRule?.name ?? '—'}</TableCell>
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
