import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { CostDashboard } from './cost-dashboard';
import { forecastCost } from '@/lib/forecast';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CostPage() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 365);

  const workspaces = await prisma.workspace.findMany({
    orderBy: { name: 'asc' },
    include: {
      connections: {
        include: {
          resources: {
            include: {
              costSnapshots: {
                where: { date: { gte: since } },
                orderBy: { date: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  type Point = { workspaceId: string; workspaceName: string; date: string; amount: number; currency: string };
  const points: Point[] = [];
  for (const w of workspaces) {
    for (const c of w.connections) {
      for (const r of c.resources) {
        for (const s of r.costSnapshots) {
          points.push({
            workspaceId: w.id,
            workspaceName: w.name,
            date: s.date.toISOString().slice(0, 10),
            amount: Number(s.amount),
            currency: s.currency,
          });
        }
      }
    }
  }

  const currency = points[0]?.currency ?? 'USD';
  const workspaceList = workspaces.map((w) => ({ id: w.id, name: w.name }));

  // Aggregate per-day totals across everything for a 30-day projection.
  const dailyMap = new Map<string, number>();
  for (const p of points) dailyMap.set(p.date, (dailyMap.get(p.date) ?? 0) + p.amount);
  const forecast = forecastCost(
    [...dailyMap.entries()].map(([date, amount]) => ({ date, amount })),
    30,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custo"
        subtitle="Acompanhe o gasto de todos os aplicativos ao longo do tempo"
      />
      {forecast && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Projeção próximos 30 dias</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatMoney(forecast.projectedTotal, currency)}</span>
            <span
              className={cn(
                'text-sm',
                forecast.trend === 'up'
                  ? 'text-rose-600'
                  : forecast.trend === 'down'
                    ? 'text-emerald-600'
                    : 'text-zinc-500',
              )}
            >
              {forecast.trend === 'up' ? '▲ subindo' : forecast.trend === 'down' ? '▼ caindo' : '— estável'}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            base: {forecast.basisDays} dia(s) · média {formatMoney(forecast.avgDailyRecent, currency)}/dia
          </div>
        </div>
      )}
      <CostDashboard points={points} workspaces={workspaceList} currency={currency} />
    </div>
  );
}
