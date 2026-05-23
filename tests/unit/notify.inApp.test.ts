import { describe, it, expect } from 'vitest';
import { prisma } from '@/db/client';
import { inAppNotifier } from '@/notify/inApp';

describe('InAppNotifier', () => {
  it('does nothing (incident row is created by collector itself)', async () => {
    // We just confirm the function resolves without DB writes.
    const before = await prisma.incident.count();
    await inAppNotifier.notify(
      { id: 'i1', resourceId: 'r1', type: 'cost_spike', severity: 'warn', message: 'spike', openedAt: new Date(), resolvedAt: null, payload: null },
      { id: 'r1', name: 'fake', kind: 'fake', connectionId: 'c1' } as never,
    );
    const after = await prisma.incident.count();
    expect(after).toBe(before);
  });
});
