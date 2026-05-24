import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { StatCard } from '@/ui/components/stat-card';
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
    <div>
      <PageHeader title="Visão geral" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Conexões"
          value={connections}
          href="/connections"
        />
        <StatCard
          label="Recursos"
          value={resources}
          href="/resources"
        />
        <StatCard
          label="Incidentes abertos"
          value={openIncidents}
          href="/incidents"
          accent={openIncidents > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Custo (30 d)"
          value={formatMoney(totalCost, currency)}
          trend={costTrend.length > 1 ? costTrend : undefined}
        />
      </div>

      {/* Top spenders */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">Maiores gastos</h2>
        {topSpenders.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados de custo ainda.</p>
        ) : (
          <ul>
            {topSpenders.map(([id, v]) => (
              <li
                key={id}
                className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0"
              >
                <Link
                  href={`/resources/${id}` as never}
                  className="text-sm font-medium text-zinc-900 hover:text-violet-600 transition-colors"
                >
                  {v.name}
                </Link>
                <span className="text-xs font-medium text-zinc-700 bg-zinc-100 rounded-full px-2.5 py-1">
                  {formatMoney(v.total, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
