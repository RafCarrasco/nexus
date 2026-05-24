import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { StatCard } from '@/ui/components/stat-card';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { formatMoney } from '@/lib/money';
import { avatarColor, initial } from '@/lib/avatar';
import { RunNow } from '@/app/(dash)/connections/run-now';

export const dynamic = 'force-dynamic';

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const w = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      connections: {
        orderBy: { createdAt: 'desc' },
        include: {
          resources: {
            include: {
              activityLog: true,
              tenants: true,
              _count: { select: { incidents: { where: { resolvedAt: null } } } },
              costSnapshots: { where: { date: { gte: since } } },
            },
          },
        },
      },
    },
  });
  if (!w) return notFound();

  const resources = w.connections.flatMap((c) =>
    c.resources.map((r) => ({ ...r, _connectionType: c.type, _connectionName: c.name }))
  );
  const cost30d = resources.reduce((s, r) => s + r.costSnapshots.reduce((ss, x) => ss + Number(x.amount), 0), 0);
  const currency = resources.flatMap((r) => r.costSnapshots)[0]?.currency ?? 'USD';
  const openInc = resources.reduce((s, r) => s + r._count.incidents, 0);

  const incidents = await prisma.incident.findMany({
    where: { resolvedAt: null, resource: { connection: { workspaceId: w.id } } },
    orderBy: { openedAt: 'desc' },
    take: 20,
    include: { resource: true },
  });

  // Group resources by kind
  const byKind = resources.reduce<Record<string, typeof resources>>((acc, r) => {
    (acc[r.kind] ??= []).push(r);
    return acc;
  }, {});
  const kinds = Object.keys(byKind).sort();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-white font-semibold text-lg shrink-0"
          style={{ backgroundColor: avatarColor(w.name) }}
        >
          {initial(w.name)}
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">{w.name}</div>
          {w.description && <div className="text-sm text-zinc-500">{w.description}</div>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conexões" value={w.connections.length} />
        <StatCard label="Recursos" value={resources.length} />
        <StatCard label="Incidentes abertos" value={openInc} href={`/workspaces/${w.slug}#incidents`} accent={openInc > 0 ? 'danger' : 'default'} />
        <StatCard label="Custo 30 d" value={formatMoney(cost30d, currency)} />
      </div>

      {/* Conexões section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Conexões</h2>
          <div className="flex items-center gap-2">
            <RunNow />
            <Button asChild size="sm">
              <Link href={`/workspaces/${slug}/connections/new` as never}>Nova conexão</Link>
            </Button>
          </div>
        </div>
        {w.connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-500">
            Nenhuma conexão ainda.{' '}
            <Link href={`/workspaces/${slug}/connections/new` as never} className="text-violet-600 hover:underline">
              Adicionar conexão
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última coleta</TableHead>
                  <TableHead>Último erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {w.connections.map((c) => {
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-zinc-900">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'active' : 'destructive'}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {c.lastCollectedAt ? c.lastCollectedAt.toISOString().slice(0, 19).replace('T', ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-zinc-500 text-xs">
                        {c.lastError ? (
                          <span className="text-red-500 truncate max-w-[200px] block" title={c.lastError}>
                            {c.lastError.slice(0, 60)}{c.lastError.length > 60 ? '…' : ''}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Recursos section — grouped by kind */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Recursos</h2>
        {resources.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 text-center text-sm text-zinc-500 shadow-sm">
            Nenhum recurso descoberto ainda. Execute o coletor após adicionar uma conexão.
          </div>
        ) : (
          kinds.map((kind) => (
            <div key={kind} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{kind}</h3>
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead>Última atividade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byKind[kind].map((r) => {
                      const meta = r.metadata as Record<string, unknown> | null ?? {};
                      const defaultUrl = meta.defaultUrl as string | undefined;
                      const incCount = r._count.incidents;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Link href={`/resources/${r.id}` as never} className="text-zinc-900 hover:text-violet-600">
                              {r.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-zinc-500 text-xs">
                            {defaultUrl ? (
                              <a href={defaultUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                                {defaultUrl}
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r._connectionType}</Badge>
                          </TableCell>
                          <TableCell>
                            {incCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                                <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                                Atenção ({incCount})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                                Tudo OK
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-600">
                            {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Incidentes abertos */}
      <section id="incidents" className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Incidentes abertos</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aberto em</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-zinc-500 py-6">
                    Sem incidentes abertos.
                  </TableCell>
                </TableRow>
              )}
              {incidents.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.openedAt.toISOString().slice(0, 19).replace('T', ' ')}</TableCell>
                  <TableCell>
                    <Link className="text-zinc-900 hover:text-violet-600" href={`/resources/${i.resourceId}` as never}>
                      {i.resource.name}
                    </Link>
                  </TableCell>
                  <TableCell>{i.type}</TableCell>
                  <TableCell>
                    <Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
