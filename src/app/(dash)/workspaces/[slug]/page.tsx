import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { StatCard } from '@/ui/components/stat-card';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { formatMoney } from '@/lib/money';
import { avatarColor, initial } from '@/lib/avatar';
import { RunNow } from '@/app/(dash)/connections/run-now';
import { DeleteConfirmDialog } from '@/ui/components/delete-confirm-dialog';
import { ConnectionCard } from '@/ui/components/connection-card';

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
        <div className="flex-1">
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">{w.name}</div>
          {w.description && <div className="text-sm text-zinc-500">{w.description}</div>}
        </div>
        <DeleteConfirmDialog
          trigger={
            <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200">
              Excluir aplicativo
            </Button>
          }
          title="Excluir aplicativo"
          confirmName={w.name}
          inputLabel="Digite o nome do aplicativo para confirmar"
          description={`Aplicativo: ${w.name}\n\nIsto vai apagar o aplicativo permanentemente. As conexões dentro dele NÃO serão apagadas — elas ficarão sem aplicativo associado (não atribuídas).`}
          endpoint={`/api/workspaces/${w.id}`}
          onSuccessRedirect="/workspaces"
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conexões" value={w.connections.length} />
        <StatCard label="Recursos" value={resources.length} />
        <StatCard label="Incidentes abertos" value={openInc} href={`/workspaces/${w.slug}#incidents`} accent={openInc > 0 ? 'danger' : 'default'} />
        <StatCard label="Custo 30 d" value={formatMoney(cost30d, currency)} />
      </div>

      {/* Conexões section — one expandable card per connection */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Conexões</h2>
          <div className="flex gap-2">
            <RunNow />
            <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
              <Link href={`/workspaces/${w.slug}/connections/new` as never}>Nova conexão</Link>
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
          <div className="space-y-3">
            {w.connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                trigger={
                  <DeleteConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                        Excluir
                      </Button>
                    }
                    title="Excluir conexão"
                    confirmName={c.name}
                    inputLabel="Digite o nome da conexão para confirmar"
                    description={`Conexão: ${c.name} (${c.type})\n\nIsto vai apagar a conexão e TODOS os recursos descobertos por ela (e seus incidentes, custos e tenants).`}
                    endpoint={`/api/connections/${c.id}`}
                  />
                }
              />
            ))}
          </div>
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
