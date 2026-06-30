import { describe, it, expect } from 'vitest';
import { classifyIncidentSource } from '@/lib/incident-source';

describe('classifyIncidentSource', () => {
  it('maps each incident type to its source lens', () => {
    expect(classifyIncidentSource({ type: 'sentry_issue' }).kind).toBe('error');
    expect(classifyIncidentSource({ type: 'uptime_down' }).kind).toBe('uptime');
    expect(classifyIncidentSource({ type: 'performance_degraded' }).kind).toBe('latency');
    expect(classifyIncidentSource({ type: 'cost_spike' }).kind).toBe('cost');
    expect(classifyIncidentSource({ type: 'ai_probe_failed' }).kind).toBe('ai');
    expect(classifyIncidentSource({ type: 'metric_threshold:cpu_pct' }).kind).toBe('metric');
    expect(classifyIncidentSource({ type: 'connection_stale' }).kind).toBe('infra');
    expect(classifyIncidentSource({ type: 'collection_failed' }).kind).toBe('infra');
    expect(classifyIncidentSource({ type: 'health_bad' }).kind).toBe('infra');
  });

  it('falls back to the AI probe relation when type is unknown', () => {
    expect(classifyIncidentSource({ type: 'weird', aiProbeId: 'p1' }).kind).toBe('ai');
  });

  it('classifies by type even when a relation is also set (perf has an uptimeCheckId)', () => {
    expect(classifyIncidentSource({ type: 'performance_degraded', uptimeCheckId: 'u1' }).kind).toBe('latency');
  });
});
