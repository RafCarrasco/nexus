import type { Resource, UptimeCheck } from '@prisma/client';
import type { IncidentContext } from './types';

/**
 * Pure builders that turn the raising entity into an IncidentContext. No IO —
 * callers pass already-loaded rows. The collector's markError uses a synthetic
 * '__connection__' placeholder resource; for that case the caller should pass the
 * connection name as the resource name so the label reads sensibly.
 */

export function buildResourceContext(resource: Resource, phase: 'open' | 'resolve'): IncidentContext {
  return {
    source: 'resource',
    label: resource.name,
    kind: resource.kind,
    phase,
  };
}

export function buildUptimeContext(check: UptimeCheck, phase: 'open' | 'resolve'): IncidentContext {
  return {
    source: 'uptime',
    label: check.name,
    kind: check.method,
    workspaceId: check.workspaceId,
    url: check.url,
    phase,
  };
}
