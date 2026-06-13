import { prisma } from '@/db/client';
import { probeUptimeUrl } from '@/lib/http';
import { evaluateUptime } from '@/lib/uptime';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';
import { buildUptimeContext } from '@/notify/context';

/**
 * Probe every enabled uptime check that is due (last check older than its interval),
 * update its state, and open/resolve an incident when it crosses the failure threshold
 * or recovers. Safe to run frequently — each check gates itself on intervalSec.
 */
export async function runUptime(now: Date = new Date()): Promise<void> {
  const checks = await prisma.uptimeCheck.findMany({ where: { enabled: true } });

  for (const c of checks) {
    if (c.lastCheckedAt && now.getTime() - c.lastCheckedAt.getTime() < c.intervalSec * 1000) continue;

    try {
      const probe = await probeUptimeUrl(c.url, c.method === 'HEAD' ? 'HEAD' : 'GET');
      const t = evaluateUptime(
        { consecutiveFails: c.consecutiveFails, lastStatus: c.lastStatus === 'down' ? 'down' : c.lastStatus === 'up' ? 'up' : null },
        probe,
        c.failThreshold,
      );

      await prisma.uptimeCheck.update({
        where: { id: c.id },
        data: {
          consecutiveFails: t.consecutiveFails,
          lastStatus: t.lastStatus,
          lastError: probe.ok ? null : (probe.error ?? `http ${probe.status ?? '?'}`),
          lastCheckedAt: now,
        },
      });

      if (t.openIncident) {
        const inc = await prisma.incident.create({
          data: {
            uptimeCheckId: c.id,
            type: 'uptime_down',
            severity: 'crit',
            message: `${c.name} indisponível: ${probe.error ?? `http ${probe.status ?? '?'}`}`,
          },
        });
        log.warn('uptime down', { check: c.name, url: c.url, fails: t.consecutiveFails });
        try {
          const ctx = buildUptimeContext(c, 'open');
          for (const n of listNotifiers()) await n.notify(inc, ctx);
        } catch (e) {
          log.warn('uptime open notify failed', { check: c.name, err: (e as Error).message });
        }
      }

      if (t.resolveIncident) {
        // Select-then-update so we can fire resolve notifications for the exact rows.
        const open = await prisma.incident.findMany({
          where: { uptimeCheckId: c.id, type: 'uptime_down', resolvedAt: null },
          select: { id: true },
        });
        if (open.length > 0) {
          await prisma.incident.updateMany({
            where: { id: { in: open.map((i) => i.id) }, resolvedAt: null },
            data: { resolvedAt: now },
          });
        }
        log.info('uptime recovered', { check: c.name, url: c.url });
        try {
          const ctx = buildUptimeContext(c, 'resolve');
          for (const i of open) {
            const inc = await prisma.incident.findUniqueOrThrow({ where: { id: i.id } });
            for (const n of listNotifiers()) await n.notify(inc, ctx);
          }
        } catch (e) {
          log.warn('uptime resolve notify failed', { check: c.name, err: (e as Error).message });
        }
      }
    } catch (e) {
      log.error('uptime check failed', { check: c.name, err: (e as Error).message });
    }
  }
}
