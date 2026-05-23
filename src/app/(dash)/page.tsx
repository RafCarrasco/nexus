import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { formatMoney } from '@/lib/money';

export default async function OverviewPage() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [connections, resources, openIncidents, costRows] = await Promise.all([
    prisma.connection.count(),
    prisma.resource.count(),
    prisma.incident.count({ where: { resolvedAt: null } }),
    prisma.costSnapshot.findMany({
      where: { date: { gte: since } },
      include: { resource: true },
    }),
  ]);

  const totalCost = costRows.reduce((s, r) => s + Number(r.amount), 0);
  const currency = costRows[0]?.currency ?? 'USD';

  const byResource = new Map<string, { name: string; total: number }>();
  for (const c of costRows) {
    const cur = byResource.get(c.resourceId) ?? { name: c.resource.name, total: 0 };
    cur.total += Number(c.amount);
    byResource.set(c.resourceId, cur);
  }
  const topSpenders = [...byResource.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" />
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardHeader><CardTitle>Connections</CardTitle></CardHeader><CardContent className="text-3xl">{connections}</CardContent></Card>
        <Card><CardHeader><CardTitle>Resources</CardTitle></CardHeader><CardContent className="text-3xl">{resources}</CardContent></Card>
        <Card><CardHeader><CardTitle>Open incidents</CardTitle></CardHeader>
          <CardContent className="text-3xl">
            {openIncidents > 0
              ? <Link href="/incidents" className="text-red-600 underline">{openIncidents}</Link>
              : 0}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Cost (30 d)</CardTitle></CardHeader><CardContent className="text-3xl">{formatMoney(totalCost, currency)}</CardContent></Card>
      </div>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Top spenders</h2>
        {topSpenders.length === 0 && <p className="text-sm text-zinc-500">No cost data yet.</p>}
        <ul className="space-y-2">
          {topSpenders.map(([id, v]) => (
            <li key={id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-2">
              <Link className="underline" href={`/resources/${id}` as never}>{v.name}</Link>
              <Badge variant="outline">{formatMoney(v.total, currency)}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
