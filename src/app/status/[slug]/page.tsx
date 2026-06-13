import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { aggregateStatus, STATUS_LABEL, STATUS_COLOR, type Status } from '@/lib/status';

export const dynamic = 'force-dynamic';

// Public, no auth (allowlisted in middleware). Client-facing status for one workspace —
// names + up/down only; no cost, no incident detail.
export default async function StatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      connections: {
        include: {
          resources: {
            include: { incidents: { where: { resolvedAt: null }, select: { severity: true, resolvedAt: true } } },
          },
        },
      },
      uptimeChecks: { where: { enabled: true }, select: { name: true, lastStatus: true } },
    },
  });
  if (!w) return notFound();

  const resources = w.connections.flatMap((c) => c.resources);
  const resourceStatuses = resources.map((r) => ({ name: r.name, status: aggregateStatus(r.incidents) }));
  const uptimeStatuses = w.uptimeChecks.map((u) => ({
    name: u.name,
    status: (u.lastStatus === 'down' ? 'crit' : 'ok') as Status,
  }));
  const items = [...resourceStatuses, ...uptimeStatuses];

  const overall: Status = items.some((i) => i.status === 'crit')
    ? 'crit'
    : items.some((i) => i.status === 'warn')
      ? 'warn'
      : 'ok';
  const c = STATUS_COLOR[overall];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-16">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32" className="text-violet-600" aria-hidden>
            <circle cx="11" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="21" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
          </svg>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{w.name}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Status do sistema</p>
          </div>
        </div>

        <div className={`flex items-center gap-3 rounded-2xl border p-5 ${c.bg} ${c.ring} ring-1`}>
          <span className={`h-3 w-3 rounded-full ${c.dot}`} />
          <span className={`text-base font-semibold ${c.text}`}>
            {overall === 'ok' ? 'Todos os sistemas operacionais' : STATUS_LABEL[overall]}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Nenhum componente monitorado.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((i, idx) => {
                const ic = STATUS_COLOR[i.status];
                return (
                  <li key={idx} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{i.name}</span>
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${ic.dot}`} />
                      <span className={`text-xs font-medium ${ic.text}`}>{STATUS_LABEL[i.status]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Atualizado {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Nexus
        </p>
      </div>
    </main>
  );
}
