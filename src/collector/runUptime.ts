import { prisma } from '@/db/client';
import { probeUptimeUrl } from '@/lib/http';
import { evaluateUptime } from '@/lib/uptime';
import { log } from '@/lib/logger';

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
        await prisma.incident.create({
          data: {
            uptimeCheckId: c.id,
            type: 'uptime_down',
            severity: 'crit',
            message: `${c.name} indisponível: ${probe.error ?? `http ${probe.status ?? '?'}`}`,
          },
        });
        log.warn('uptime down', { check: c.name, url: c.url, fails: t.consecutiveFails });
      }

      if (t.resolveIncident) {
        await prisma.incident.updateMany({
          where: { uptimeCheckId: c.id, type: 'uptime_down', resolvedAt: null },
          data: { resolvedAt: now },
        });
        log.info('uptime recovered', { check: c.name, url: c.url });
      }
    } catch (e) {
      log.error('uptime check failed', { check: c.name, err: (e as Error).message });
    }
  }
}
