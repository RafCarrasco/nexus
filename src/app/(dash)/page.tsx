import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { StatCard } from '@/ui/components/stat-card';
import { WorkspaceCard } from '@/ui/components/workspace-card';
import { Button } from '@/ui/components/button';
import { formatMoney } from '@/lib/money';
import { CostDisplay } from '@/ui/components/cost-display';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [connections, resources, openIncidents, costRows, workspaces] = await Promise.all([
    prisma.connection.count(),
    prisma.resource.count(),
    prisma.incident.count({ where: { resolvedAt: null } }),
    prisma.costSnapshot.findMany({
      where: { date: { gte: since } },
      include: { resource: true },
    }),
    prisma.workspace.findMany({
      orderBy: { name: 'asc' },
      include: {
        connections: {
          include: {
            resources: {
              include: {
                _count: { select: { incidents: { where: { resolvedAt: null } } } },
                costSnapshots: { where: { date: { gte: since } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const totalCost = costRows.reduce((s, r) => s + Number(r.amount), 0);
  const currency = costRows[0]?.currency ?? 'USD';
  const noCostData = costRows.length === 0;

  // Build sparkline: daily cost totals for last 30 days
  const dailyMap = new Map<string, number>();
  for (const c of costRows) {
    const day = c.date.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(c.amount));
  }
  const costTrend = [...dailyMap.values()];

  // Top spenders
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
    <div className="space-y-8">
      <PageHeader title="Visão geral" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conexões" value={connections} href="/connections" />
        <StatCard label="Recursos" value={resources} href="/resources" />
        <StatCard
          label="Incidentes abertos"
          value={openIncidents}
          href="/incidents"
          accent={openIncidents > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Custo (30 d)"
          value={<CostDisplay amount={totalCost} currency={currency} notConfigured={noCostData} size="lg" />}
          trend={costTrend.length > 1 ? costTrend : undefined}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Aplicativos</h2>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href={'/workspaces' as never}>Ver todos</Link>
          </Button>
        </div>
        {workspaces.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <div className="text-sm font-medium text-zinc-700">Nenhum aplicativo cadastrado</div>
            <div className="mt-1 text-xs text-zinc-500">Crie um aplicativo pra agrupar conexões e recursos.</div>
            <Button asChild className="mt-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
              <Link href={'/workspaces/new' as never}>Criar primeiro aplicativo</Link>
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((w) => {
            const wResources = w.connections.flatMap((c) => c.resources);
            const wCost = wResources.reduce(
              (s, r) => s + r.costSnapshots.reduce((ss, x) => ss + Number(x.amount), 0),
              0
            );
            const wOpenInc = wResources.reduce((s, r) => s + r._count.incidents, 0);
            const wCurrency = wResources[0]?.costSnapshots[0]?.currency ?? 'USD';
            const wNoCostData = wResources.flatMap((r) => r.costSnapshots).length === 0;
            return (
              <WorkspaceCard
                key={w.id}
                workspace={{ id: w.id, slug: w.slug, name: w.name, description: w.description }}
                resourceCount={wResources.length}
                openIncidents={wOpenInc}
                cost30d={wCost}
                currency={wCurrency}
                notConfigured={wNoCostData}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Maiores gastos</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {topSpenders.length === 0 && <p className="text-sm text-zinc-500">Sem dados de custo ainda.</p>}
          <ul className="divide-y divide-zinc-100">
            {topSpenders.map(([id, v]) => (
              <li key={id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <Link
                  className="text-sm font-medium text-zinc-900 hover:text-violet-600"
                  href={`/resources/${id}` as never}
                >
                  {v.name}
                </Link>
                <span className="text-xs font-medium text-zinc-700 bg-zinc-100 rounded-full px-2.5 py-1">
                  {formatMoney(v.total, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
