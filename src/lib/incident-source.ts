/**
 * Classify an incident into a "source" — the kind of signal that raised it. Drives the
 * Sentry-style feed: each source gets its own icon, label and lens, so error / uptime /
 * latency / cost / AI-quality / metric / infra incidents read distinctly in one list.
 * Pure — no DB. Classify by type first (most specific), then fall back to the relation.
 */
export type IncidentSourceKind = 'error' | 'uptime' | 'latency' | 'cost' | 'ai' | 'metric' | 'infra';

export type IncidentSource = { kind: IncidentSourceKind; label: string };

export function classifyIncidentSource(input: {
  type: string;
  uptimeCheckId?: string | null;
  aiProbeId?: string | null;
}): IncidentSource {
  const t = input.type;
  if (t === 'sentry_issue' || t.startsWith('sentry')) return { kind: 'error', label: 'Sentry' };
  if (t === 'uptime_down') return { kind: 'uptime', label: 'uptime' };
  if (t === 'performance_degraded') return { kind: 'latency', label: 'latência' };
  if (t === 'cost_spike' || t.startsWith('cost')) return { kind: 'cost', label: 'custo' };
  if (t === 'ai_probe_failed' || input.aiProbeId) return { kind: 'ai', label: 'qualidade IA' };
  if (t.startsWith('metric_threshold')) return { kind: 'metric', label: 'métrica' };
  // collection_failed, connection_stale, health_bad and anything else → infrastructure.
  return { kind: 'infra', label: 'infra' };
}
