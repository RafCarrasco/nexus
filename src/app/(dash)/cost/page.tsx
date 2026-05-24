import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { CostDashboard } from './cost-dashboard';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custo"
        subtitle="Acompanhe o gasto de todos os aplicativos ao longo do tempo"
      />
      <CostDashboard points={points} workspaces={workspaceList} currency={currency} />
    </div>
  );
}
