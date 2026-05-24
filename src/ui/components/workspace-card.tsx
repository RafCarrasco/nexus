import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { avatarColor, initial } from '@/lib/avatar';
import { CostDisplay } from '@/ui/components/cost-display';
import { StatusPill } from '@/ui/components/status-pill';
import type { Status } from '@/lib/status';

type Props = {
  workspace: { id: string; slug: string; name: string; description: string | null };
  resourceCount: number;
  openIncidents: number;
  status: Status;
  cost30d: number;
  currency?: string;
  notConfigured?: boolean;
};

export function WorkspaceCard({
  workspace,
  resourceCount,
  openIncidents,
  status,
  cost30d,
  currency = 'USD',
  notConfigured,
}: Props) {
  return (
    <Link
      href={`/workspaces/${workspace.slug}` as never}
      className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: avatarColor(workspace.name) }}
          >
            {initial(workspace.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900">{workspace.name}</div>
            {workspace.description && (
              <div className="truncate text-xs text-zinc-500">{workspace.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} count={openIncidents} />
          <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-violet-600" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 py-2">
          <div className="text-xs text-zinc-500">Recursos</div>
          <div className="text-sm font-semibold text-zinc-900">{resourceCount}</div>
        </div>
        <div className="rounded-lg bg-zinc-50 py-2">
          <div className="text-xs text-zinc-500">Incidentes</div>
          <div className="text-sm font-semibold text-zinc-900">{openIncidents}</div>
        </div>
        <div className="rounded-lg bg-zinc-50 py-2">
          <div className="text-xs text-zinc-500">Custo 30d</div>
          <div className="text-sm font-semibold text-zinc-900">
            <CostDisplay amount={cost30d} currency={currency} notConfigured={notConfigured} size="sm" />
          </div>
        </div>
      </div>
    </Link>
  );
}
