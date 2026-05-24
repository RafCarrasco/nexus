import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { formatMoney } from '@/lib/money';
import { DeleteConfirmDialog } from '@/ui/components/delete-confirm-dialog';

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.resource.findUnique({
    where: { id },
    include: {
      connection: true,
      activityLog: true,
      tenants: true,
      incidents: { orderBy: { openedAt: 'desc' }, take: 50 },
      costSnapshots: { orderBy: { date: 'desc' }, take: 30 },
    },
  });
  if (!r) return notFound();

  const total30d = r.costSnapshots.reduce((s, c) => s + Number(c.amount), 0);
  const currency = r.costSnapshots[0]?.currency ?? 'USD';

  return (
    <>
      <PageHeader
        title={r.name}
        action={
          <DeleteConfirmDialog
            trigger={
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200">
                Excluir recurso
              </Button>
            }
            title="Excluir recurso"
            confirmName={r.name}
            inputLabel="Digite o nome do recurso para confirmar"
            description={`Recurso: ${r.name} (${r.kind})\nConexão: ${r.connection.name}\n\nIsto vai apagar o recurso permanentemente, junto com todos os seus tenants, snapshots de custo, log de atividade e incidentes.`}
            endpoint={`/api/resources/${r.id}`}
            onSuccessRedirect="/resources"
          />
        }
      />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Provedor</CardTitle></CardHeader>
          <CardContent><Badge>{r.connection.type}</Badge> · {r.connection.name}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Última atividade</CardTitle></CardHeader>
          <CardContent className="text-2xl">
            {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Custo 30 dias</CardTitle></CardHeader>
          <CardContent className="text-2xl">{formatMoney(total30d, currency)}</CardContent>
        </Card>
      </div>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Tenants</h2>
        {r.tenants.length === 0 && <p className="text-sm text-zinc-500">Nenhum tenant descoberto.</p>}
        {r.tenants.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>ID externo</TableHead><TableHead>Cliente</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {r.tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell className="font-mono text-xs">{t.externalId}</TableCell>
                  <TableCell>{t.clientId ?? '—'}</TableCell>
                  <TableCell>
                    <DeleteConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                          Excluir
                        </Button>
                      }
                      title="Excluir tenant"
                      confirmName={t.displayName}
                      inputLabel="Digite o nome do tenant para confirmar"
                      description={`Tenant: ${t.displayName}\nID externo: ${t.externalId}\n\nIsto vai apagar este tenant permanentemente.`}
                      endpoint={`/api/tenants/${t.id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Incidentes recentes</h2>
        {r.incidents.length === 0 && <p className="text-sm text-zinc-500">Sem incidentes.</p>}
        {r.incidents.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Aberto em</TableHead><TableHead>Tipo</TableHead><TableHead>Severidade</TableHead><TableHead>Mensagem</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.incidents.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.openedAt.toISOString().slice(0, 19).replace('T', ' ')}</TableCell>
                  <TableCell>{i.type}</TableCell>
                  <TableCell><Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge></TableCell>
                  <TableCell className="max-w-[480px] truncate">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Custo (últimos 30 snapshots)</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Origem</TableHead></TableRow></TableHeader>
          <TableBody>
            {r.costSnapshots.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.date.toISOString().slice(0, 10)}</TableCell>
                <TableCell>{formatMoney(Number(c.amount), c.currency)}</TableCell>
                <TableCell><Badge variant="outline">{c.source}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
