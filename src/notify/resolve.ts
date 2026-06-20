import { prisma } from '@/db/client';
import { log } from '@/lib/logger';
import { listNotifiers } from './registry';
import { buildResourceContext, buildUptimeContext, buildAiProbeContext } from './context';
import type { IncidentContext } from './types';

/**
 * Fire phase:'resolve' notifications for incidents that were just resolved manually
 * (bulk action or PATCH route). Loads each incident with whichever entity raised it,
 * builds the right context, and runs every notifier. Best-effort: a failure here must
 * never break the request that resolved the incident.
 */
export async function notifyResolvedIncidents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const incidents = await prisma.incident.findMany({
      where: { id: { in: ids } },
      include: { resource: true, uptimeCheck: true, aiProbe: true },
    });
    const notifiers = listNotifiers();
    for (const inc of incidents) {
      let ctx: IncidentContext | null = null;
      if (inc.resource) ctx = buildResourceContext(inc.resource, 'resolve');
      else if (inc.uptimeCheck) ctx = buildUptimeContext(inc.uptimeCheck, 'resolve');
      else if (inc.aiProbe) ctx = buildAiProbeContext(inc.aiProbe, 'resolve');
      if (!ctx) continue;
      for (const n of notifiers) {
        try {
          await n.notify(inc, ctx);
        } catch (e) {
          log.warn('resolve notify failed', { incident: inc.id, notifier: n.id, err: (e as Error).message });
        }
      }
    }
  } catch (e) {
    log.warn('resolve notify batch failed', { err: (e as Error).message });
  }
}
