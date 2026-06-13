import { prisma } from '@/db/client';
import { evaluateAlert } from '@/lib/alerting';
import { log } from '@/lib/logger';

const METRIC_LABEL: Record<string, string> = {
  cost_30d: 'custo 30d',
  open_incidents: 'incidentes abertos',
};

/** Compute the current value of a rule's metric, scoped global or per-workspace. */
async function metricValue(metric: string, workspaceId: string | null, since: Date): Promise<number> {
  if (metric === 'cost_30d') {
    const rows = await prisma.costSnapshot.findMany({
      where: workspaceId
        ? { date: { gte: since }, resource: { connection: { workspaceId } } }
        : { date: { gte: since } },
      select: { amount: true },
    });
    return rows.reduce((s, r) => s + Number(r.amount), 0);
  }
  if (metric === 'open_incidents') {
    // Exclude alert-raised incidents so an open_incidents rule can't count its own.
    return prisma.incident.count({
      where: workspaceId
        ? { resolvedAt: null, alertRuleId: null, resource: { connection: { workspaceId } } }
        : { resolvedAt: null, alertRuleId: null },
    });
  }
  return 0;
}

/**
 * Evaluate every enabled alert rule and open/resolve an incident on threshold crossings.
 * Cheap (DB aggregates) — safe to run on the regular collector cadence.
 */
export async function runAlerts(now: Date = new Date()): Promise<void> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });

  for (const rule of rules) {
    try {
      const value = await metricValue(rule.metric, rule.workspaceId, since);
      const ev = evaluateAlert(value, rule.operator, rule.threshold, rule.isFiring);

      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { isFiring: ev.firing, lastValue: value, lastEvalAt: now },
      });

      if (ev.openIncident) {
        const cmp = rule.operator === 'lt' ? '<' : '>';
        await prisma.incident.create({
          data: {
            alertRuleId: rule.id,
            type: 'alert',
            severity: 'warn',
            message: `Alerta "${rule.name}": ${METRIC_LABEL[rule.metric] ?? rule.metric} = ${value} (limite ${cmp} ${rule.threshold})`,
          },
        });
        log.warn('alert firing', { rule: rule.name, value, threshold: rule.threshold });
      }

      if (ev.resolveIncident) {
        await prisma.incident.updateMany({
          where: { alertRuleId: rule.id, resolvedAt: null },
          data: { resolvedAt: now },
        });
        log.info('alert recovered', { rule: rule.name, value });
      }
    } catch (e) {
      log.error('alert eval failed', { rule: rule.name, err: (e as Error).message });
    }
  }
}
