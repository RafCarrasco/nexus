import { prisma } from '@/db/client';
import { probeUptimeUrl } from '@/lib/http';
import { evaluateUptime } from '@/lib/uptime';
import { evaluateLatencyDegradation } from '@/lib/latency-trend';
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
          lastLatencyMs: probe.latencyMs ?? null,
          lastCheckedAt: now,
        },
      });

      // Time-series sample for latency-trend detection + the uptime sparkline.
      await prisma.uptimeSample.create({
        data: { uptimeCheckId: c.id, ok: probe.ok, status: probe.status ?? null, latencyMs: probe.latencyMs ?? null, at: now },
      });

      // evaluateUptime only signals openIncident on the down *transition*. A check stuck
      // 'down' therefore won't re-open after an operator manually resolves while it's still
      // failing — the incident stays masked. Guard: if the probe failed and we're already
      // down but no transition fired, ensure an open incident exists (idempotent findFirst).
      let shouldOpen = t.openIncident;
      if (!shouldOpen && !probe.ok && t.lastStatus === 'down') {
        const existing = await prisma.incident.findFirst({
          where: { uptimeCheckId: c.id, type: 'uptime_down', resolvedAt: null },
        });
        if (!existing) shouldOpen = true;
      }

      if (shouldOpen) {
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
        const ids = open.map((i) => i.id);
        if (ids.length > 0) {
          await prisma.incident.updateMany({
            where: { id: { in: ids }, resolvedAt: null },
            data: { resolvedAt: now },
          });
        }
        log.info('uptime recovered', { check: c.name, url: c.url });
        try {
          const ctx = buildUptimeContext(c, 'resolve');
          // Re-fetch in one query AFTER the update so resolvedAt is stamped (notify-format reads it).
          const resolved = ids.length > 0 ? await prisma.incident.findMany({ where: { id: { in: ids } } }) : [];
          for (const inc of resolved) {
            for (const n of listNotifiers()) await n.notify(inc, ctx);
          }
        } catch (e) {
          log.warn('uptime resolve notify failed', { check: c.name, err: (e as Error).message });
        }
      }

      // Latency degradation is only meaningful while the check is up — a down check is
      // already covered by the uptime_down incident. Compare recent p95 vs 7-day baseline.
      if (probe.ok) await evaluatePerfDegradation(c, now);
    } catch (e) {
      log.error('uptime check failed', { check: c.name, err: (e as Error).message });
    }
  }
}

/**
 * Open/resolve a `performance_degraded` (warn) incident for an uptime check based on its
 * recent latency trend. Idempotent: at most one open perf incident per check at a time.
 */
async function evaluatePerfDegradation(c: import('@prisma/client').UptimeCheck, now: Date): Promise<void> {
  const since7d = new Date(now.getTime() - 7 * 86_400_000);
  const since1h = new Date(now.getTime() - 3_600_000);
  const samples = await prisma.uptimeSample.findMany({
    where: { uptimeCheckId: c.id, ok: true, latencyMs: { not: null }, at: { gte: since7d } },
    select: { latencyMs: true, at: true },
  });
  const recent: number[] = [];
  const baseline: number[] = [];
  for (const s of samples) {
    if (s.latencyMs == null) continue;
    if (s.at >= since1h) recent.push(s.latencyMs);
    else baseline.push(s.latencyMs);
  }
  const res = evaluateLatencyDegradation(recent, baseline);

  const open = await prisma.incident.findFirst({
    where: { uptimeCheckId: c.id, type: 'performance_degraded', resolvedAt: null },
  });

  if (res.degraded && res.p95Recent != null && res.baseline != null && !open) {
    const inc = await prisma.incident.create({
      data: {
        uptimeCheckId: c.id,
        type: 'performance_degraded',
        severity: 'warn',
        message: `${c.name} lento: p95 ${Math.round(res.p95Recent)}ms vs baseline ${Math.round(res.baseline)}ms (${(res.p95Recent / res.baseline).toFixed(1)}×)`,
        payload: { p95Recent: res.p95Recent, baseline: res.baseline },
      },
    });
    log.warn('uptime degraded', { check: c.name, p95: res.p95Recent, baseline: res.baseline });
    try {
      const ctx = buildUptimeContext(c, 'open');
      for (const n of listNotifiers()) await n.notify(inc, ctx);
    } catch (e) {
      log.warn('perf open notify failed', { check: c.name, err: (e as Error).message });
    }
  } else if (!res.degraded && open) {
    await prisma.incident.update({ where: { id: open.id }, data: { resolvedAt: now } });
    log.info('uptime latency recovered', { check: c.name });
    try {
      const ctx = buildUptimeContext(c, 'resolve');
      const resolved = await prisma.incident.findUniqueOrThrow({ where: { id: open.id } });
      for (const n of listNotifiers()) await n.notify(resolved, ctx);
    } catch (e) {
      log.warn('perf resolve notify failed', { check: c.name, err: (e as Error).message });
    }
  }
}
