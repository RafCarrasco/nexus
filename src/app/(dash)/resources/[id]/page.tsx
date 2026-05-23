import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { formatMoney } from '@/lib/money';

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
      <PageHeader title={r.name} />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Provider</CardTitle></CardHeader>
          <CardContent><Badge>{r.connection.type}</Badge> · {r.connection.name}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Last activity</CardTitle></CardHeader>
          <CardContent className="text-2xl">
            {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>30-day cost</CardTitle></CardHeader>
          <CardContent className="text-2xl">{formatMoney(total30d, currency)}</CardContent>
        </Card>
      </div>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Tenants</h2>
        {r.tenants.length === 0 && <p className="text-sm text-zinc-500">No tenants discovered.</p>}
        {r.tenants.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>External ID</TableHead><TableHead>Client</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell className="font-mono text-xs">{t.externalId}</TableCell>
                  <TableCell>{t.clientId ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Recent incidents</h2>
        {r.incidents.length === 0 && <p className="text-sm text-zinc-500">No incidents.</p>}
        {r.incidents.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Opened</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
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
        <h2 className="mb-2 text-lg font-semibold">Cost (last 30 snapshots)</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
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
