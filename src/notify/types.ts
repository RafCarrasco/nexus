import type { Incident } from '@prisma/client';

/**
 * What raised the incident and how to describe it to an outbound channel.
 * Incidents can come from a Resource or an UptimeCheck — only the resource path
 * carries a real Resource row, so notifiers must work off this normalized
 * context instead of a Resource.
 */
export interface IncidentContext {
  source: 'resource' | 'uptime';
  label: string; // human-readable name of the thing that broke
  kind?: string; // resource kind / metric / etc. (optional detail)
  workspaceId?: string | null;
  url?: string; // relevant URL (uptime target), never a secret
  phase: 'open' | 'resolve';
}

export interface Notifier {
  readonly id: string;
  notify(incident: Incident, ctx: IncidentContext): Promise<void>;
}
