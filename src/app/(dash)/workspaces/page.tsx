import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Button } from '@/ui/components/button';
import { WorkspaceCard } from '@/ui/components/workspace-card';
import { aggregateStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const workspaces = await prisma.workspace.findMany({
    orderBy: { name: 'asc' },
    include: {
      connections: {
        include: {
          resources: {
            include: {
              _count: { select: { incidents: { where: { resolvedAt: null } } } },
              costSnapshots: { where: { date: { gte: since } } },
              incidents: {
                where: { resolvedAt: null },
                select: { severity: true, resolvedAt: true },
              },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aplicativos"
        action={
          <Button asChild>
            <Link href={'/workspaces/new' as never}>Novo aplicativo</Link>
          </Button>
        }
      />
      {workspaces.length === 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nenhum aplicativo cadastrado</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Crie o primeiro pra agrupar suas conexões.</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((w) => {
          const resources = w.connections.flatMap((c) => c.resources);
          const cost = resources.reduce(
            (s, r) => s + r.costSnapshots.reduce((ss, x) => ss + Number(x.amount), 0),
            0,
          );
          const openInc = resources.reduce((s, r) => s + r._count.incidents, 0);
          const currency = resources[0]?.costSnapshots[0]?.currency ?? 'USD';
          const allInc = resources.flatMap((r) => r.incidents);
          const status = aggregateStatus(allInc);
          return (
            <WorkspaceCard
              key={w.id}
              workspace={{ id: w.id, slug: w.slug, name: w.name, description: w.description }}
              resourceCount={resources.length}
              openIncidents={openInc}
              status={status}
              cost30d={cost}
              currency={currency}
            />
          );
        })}
      </div>
    </div>
  );
}
