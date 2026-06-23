import { prisma } from '@/db/client';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';
import { buildResourceContext } from '@/notify/context';
import { notifyResolvedIncidents } from '@/notify/resolve';
import { compareMetric, OP_LABEL, thresholdIncidentType, type MetricOperator } from '@/lib/metric-threshold';

/**
 * Evaluate every enabled MetricThreshold against the latest ingested Metric value within
 * its lookback window, opening/resolving a `metric_threshold:<name>` incident. This is the
 * piece that makes the (previously inert) Metric model an early-warning signal: an app
 * pushes cpu/mem/queue_depth/error_rate via the ingest API and Nexus fires before those
 * cross into a user-facing outage. Safe to run frequently — idempotent per rule.
 */
export async function runMetricEval(now: Date = new Date()): Promise<void> {
  const rules = await prisma.metricThreshold.findMany({ where: { enabled: true }, include: { resource: true } });

  for (const rule of rules) {
    try {
      const since = new Date(now.getTime() - rule.lookbackSec * 1000);
      const latest = await prisma.metric.findFirst({
        where: { resourceId: rule.resourceId, name: rule.metricName, timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
      });
      const type = thresholdIncidentType(rule.metricName);

      if (!latest) {
        // No fresh sample within lookback — record the eval pass, leave incident state as-is.
        await prisma.metricThreshold.update({ where: { id: rule.id }, data: { lastEvalAt: now } });
        continue;
      }

      const value = Number(latest.value);
      const threshold = Number(rule.threshold);
      const breached = compareMetric(value, rule.operator, threshold);
      await prisma.metricThreshold.update({
        where: { id: rule.id },
        data: { lastEvalAt: now, lastValue: latest.value },
      });

      const open = await prisma.incident.findFirst({
        where: { resourceId: rule.resourceId, type, resolvedAt: null },
      });

      if (breached && !open) {
        const opLabel = OP_LABEL[rule.operator as MetricOperator] ?? rule.operator;
        const unit = latest.unit ? ` ${latest.unit}` : '';
        const inc = await prisma.incident.create({
          data: {
            resourceId: rule.resourceId,
            type,
            severity: rule.severity === 'crit' ? 'crit' : 'warn',
            message: `${rule.metricName} ${value}${unit} ${opLabel} ${threshold}`,
            payload: {
              metricName: rule.metricName,
              value,
              operator: rule.operator,
              threshold,
              unit: latest.unit,
              at: latest.timestamp.toISOString(),
            },
          },
        });
        const ctx = buildResourceContext(rule.resource, 'open');
        try {
          for (const n of listNotifiers()) await n.notify(inc, ctx);
        } catch (e) {
          log.warn('metric threshold notify failed', { rule: rule.id, err: (e as Error).message });
        }
        log.warn('metric threshold crossed', {
          resource: rule.resource.name,
          metric: rule.metricName,
          value,
          op: rule.operator,
          threshold,
        });
      } else if (!breached && open) {
        await prisma.incident.update({ where: { id: open.id }, data: { resolvedAt: now } });
        await notifyResolvedIncidents([open.id]);
        log.info('metric threshold recovered', { resource: rule.resource.name, metric: rule.metricName });
      }
    } catch (e) {
      log.warn('metric eval failed', { rule: rule.id, err: (e as Error).message });
    }
  }
}
