import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge } from '@/ui/components/badge';
import { CostDisplay } from '@/ui/components/cost-display';

type Resource = {
  id: string;
  externalId: string;
  name: string;
  kind: string;
  metadata: any; // Prisma JsonValue: can be string|number|boolean|null|object|array
  _count: { incidents: number };
  costSnapshots: Array<{ amount: unknown; currency: string }>;
};

type Props = {
  connection: {
    id: string;
    name: string;
    type: string;
    status: string;
    lastError: string | null;
    lastCollectedAt: Date | null;
    resources: Resource[];
  };
  trigger?: ReactNode;
};

export function ConnectionCard({ connection, trigger }: Props) {
  const groups = new Map<string, Resource[]>();
  for (const r of connection.resources) {
    const arr = groups.get(r.kind) ?? [];
    arr.push(r);
    groups.set(r.kind, arr);
  }

  const totalIncidents = connection.resources.reduce((s, r) => s + r._count.incidents, 0);
  const totalCost = connection.resources.reduce(
    (s, r) => s + r.costSnapshots.reduce((ss, c) => ss + Number(c.amount), 0),
    0,
  );
  const currency = connection.resources.flatMap((r) => r.costSnapshots)[0]?.currency ?? 'USD';
  const noCostData = connection.resources.flatMap((r) => r.costSnapshots).length === 0;

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm open:shadow-md transition" open>
      <summary className="cursor-pointer list-none p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-1">
              <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-0 -rotate-90" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-zinc-900">{connection.name}</span>
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {connection.type}
                </Badge>
                <Badge
                  variant={connection.status === 'active' ? 'default' : 'destructive'}
                  className="text-[10px]"
                >
                  {connection.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {connection.lastCollectedAt
                  ? `Última coleta ${connection.lastCollectedAt.toISOString().slice(0, 19).replace('T', ' ')}`
                  : 'Nunca coletada'}
                {connection.lastError && (
                  <span className="ml-2 text-red-600">· erro: {connection.lastError.slice(0, 80)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-zinc-500">Recursos</div>
              <div className="text-sm font-semibold text-zinc-900">{connection.resources.length}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">Incidentes</div>
              <div className={`text-sm font-semibold ${totalIncidents > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                {totalIncidents}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">Custo 30d</div>
              <div className="text-sm font-semibold text-zinc-900">
                <CostDisplay amount={totalCost} currency={currency} notConfigured={noCostData} size="sm" />
              </div>
            </div>
            {trigger}
          </div>
        </div>
      </summary>

      <div className="border-t border-zinc-100 px-5 py-4 space-y-5">
        {connection.resources.length === 0 && (
          <p className="text-sm text-zinc-500">
            Nenhum recurso descoberto ainda. Clique em Rodar coletor agora.
          </p>
        )}
        {[...groups.entries()].map(([kind, resources]) => (
          <div key={kind}>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              {kindLabel(kind)} · {resources.length}
            </div>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 overflow-hidden">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      <Link href={`/resources/${r.id}` as never} className="hover:text-violet-600">
                        {r.name}
                      </Link>
                    </div>
                    {r.metadata?.defaultUrl && (
                      <a
                        href={String(r.metadata.defaultUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1"
                      >
                        {String(r.metadata.defaultUrl)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r._count.incidents > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {r._count.incidents}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        OK
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    'firebase-project': 'Projeto Firebase',
    'firebase-hosting': 'Hosting',
    'firebase-firestore': 'Firestore',
    'firebase-function': 'Cloud Function',
    'supabase-project': 'Projeto Supabase',
    container: 'Container Docker',
  };
  return map[kind] ?? kind;
}
