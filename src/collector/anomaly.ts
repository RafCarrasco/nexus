import { prisma } from '@/db/client';
import { daysBackUtc } from '@/lib/dates';
import { listNotifiers } from '@/notify/registry';

const SPIKE_MULTIPLIER = 1.5;
const SPIKE_FLOOR_USD = 1;

export async function detectCostSpikes(forDate: Date): Promise<void> {
  const resources = await prisma.resource.findMany();
  const windowStart = daysBackUtc(forDate, 7);
  for (const r of resources) {
    const latest = await prisma.costSnapshot.findFirst({
      where: { resourceId: r.id, date: forDate },
      orderBy: { id: 'desc' },
    });
    if (!latest) continue;
    const latestAmt = Number(latest.amount);
    if (latestAmt < SPIKE_FLOOR_USD) continue;

    const history = await prisma.costSnapshot.findMany({
      where: { resourceId: r.id, date: { gte: windowStart, lt: forDate } },
    });
    if (history.length < 3) continue; // not enough signal
    const avg = history.reduce((s, x) => s + Number(x.amount), 0) / history.length;
    if (latestAmt <= avg * SPIKE_MULTIPLIER) continue;

    const open = await prisma.incident.findFirst({
      where: { resourceId: r.id, type: 'cost_spike', resolvedAt: null },
    });
    if (open) continue;

    const inc = await prisma.incident.create({
      data: {
        resourceId: r.id,
        type: 'cost_spike',
        severity: 'warn',
        message: `Cost ${latestAmt.toFixed(2)} ${latest.currency} is ${(latestAmt / avg).toFixed(1)}× the 7-day avg of ${avg.toFixed(2)}`,
        payload: { latest: latestAmt, avg7d: avg },
      },
    });
    for (const n of listNotifiers()) await n.notify(inc, r);
  }
}
