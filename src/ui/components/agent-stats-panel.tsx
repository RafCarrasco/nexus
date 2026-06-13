import { Badge } from './badge';

export type N8nExecStats = {
  window: number;
  success: number;
  error: number;
  running: number;
  errorRate: number;
  avgDurationMs: number | null;
  lastErrorAt: string | null;
  lastRunAt: string | null;
};

/**
 * Agent-run telemetry for an n8n-workflow resource, from the execStats captured by
 * the provider. Presentational — no fetching.
 */
export function AgentStatsPanel({
  stats,
  recentTokens,
  recentModel,
  recentTokenCostUsd,
}: {
  stats?: N8nExecStats | null;
  recentTokens?: number;
  recentModel?: string;
  recentTokenCostUsd?: number;
}) {
  if (!stats) return null;
  const pct = Math.round(stats.errorRate * 100);
  const errVariant = stats.errorRate === 0 ? 'active' : stats.errorRate < 0.5 ? 'default' : 'destructive';
  const tokenValue =
    recentTokens != null
      ? recentTokenCostUsd != null
        ? `${recentTokens.toLocaleString('pt-BR')} (~$${recentTokenCostUsd.toFixed(4)})`
        : recentTokens.toLocaleString('pt-BR')
      : '—';

  return (
    <section className="p-6">
      <h2 className="mb-3 text-lg font-semibold">Agente / execuções</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Janela" value={`${stats.window} exec`} />
        <Stat label="Taxa de erro" value={`${pct}%`} badgeVariant={errVariant} />
        <Stat
          label="Duração média"
          value={stats.avgDurationMs != null ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : '—'}
        />
        <Stat label="Tokens IA (últ.)" value={tokenValue} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        ✓ {stats.success} sucesso · ✕ {stats.error} erro
        {stats.running ? ` · ${stats.running} rodando` : ''}
        {recentModel ? ` · modelo ${recentModel}` : ''}
        {stats.lastErrorAt ? ` · último erro ${stats.lastErrorAt.slice(0, 19).replace('T', ' ')}` : ''}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  badgeVariant,
}: {
  label: string;
  value: string;
  badgeVariant?: 'active' | 'default' | 'destructive';
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">
        {badgeVariant ? <Badge variant={badgeVariant}>{value}</Badge> : value}
      </div>
    </div>
  );
}
