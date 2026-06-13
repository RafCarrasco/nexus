import { describe, it, expect } from 'vitest';
import { prisma } from '@/db/client';
import { inAppNotifier } from '@/notify/inApp';
import type { IncidentContext } from '@/notify/types';

describe('InAppNotifier', () => {
  it('does nothing (incident row is created by collector itself)', async () => {
    // We just confirm the function resolves without DB writes.
    const before = await prisma.incident.count();
    const ctx: IncidentContext = { source: 'resource', label: 'fake', kind: 'fake', phase: 'open' };
    await inAppNotifier.notify(
      { id: 'i1', resourceId: 'r1', uptimeCheckId: null, alertRuleId: null, type: 'cost_spike', severity: 'warn', message: 'spike', openedAt: new Date(), resolvedAt: null, payload: null },
      ctx,
    );
    const after = await prisma.incident.count();
    expect(after).toBe(before);
  });
});
