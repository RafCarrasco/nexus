import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { StatCard } from '@/ui/components/stat-card';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { formatMoney } from '@/lib/money';
import { avatarColor, initial } from '@/lib/avatar';

export const dynamic = 'force-dynamic';

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const w = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      connections: {
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

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conexões" value={w.connections.length} href={`/connections?workspace=${w.slug}`} />
        <StatCard label="Recursos" value={resources.length} />
        <StatCard label="Incidentes abertos" value={openInc} href={`/workspaces/${w.slug}#incidents`} accent={openInc > 0 ? 'danger' : 'default'} />
        <StatCard label="Custo 30 d" value={formatMoney(cost30d, currency)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Recursos</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead>Incidentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-zinc-500 py-6">
                    Nenhum recurso descoberto ainda.
                  </TableCell>
                </TableRow>
              )}
              {resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/resources/${r.id}` as never} className="text-zinc-900 hover:text-violet-600">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-600">{r.kind}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r._connectionType}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r._count.incidents > 0 ? (
                      <Badge variant="destructive">{r._count.incidents}</Badge>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

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
