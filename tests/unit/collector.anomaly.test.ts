import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/db/client';
import { detectCostSpikes } from '@/collector/anomaly';

process.env.NEXUS_MASTER_KEY ??= Buffer.alloc(32, 7).toString('base64');

async function cleanup() {
  await prisma.incident.deleteMany();
  await prisma.costSnapshot.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

let resourceId: string;

beforeAll(async () => {
  await cleanup();
  const u = await prisma.user.create({ data: { email: 'a@procurementgarage.com' } });
  const c = await prisma.connection.create({
    data: { name: 'c', type: 'fake', ownerUserId: u.id, credentials: Buffer.from([]) },
  });
  const r = await prisma.resource.create({
    data: { connectionId: c.id, externalId: 'r', name: 'r', kind: 'k', metadata: {} },
  });
  resourceId = r.id;
});

beforeEach(async () => {
  await prisma.incident.deleteMany();
  await prisma.costSnapshot.deleteMany();
});

async function seed(date: string, amount: number) {
  await prisma.costSnapshot.create({
    data: { resourceId, date: new Date(date), amount, currency: 'USD', source: 'fake' },
  });
}

describe('detectCostSpikes', () => {
  it('opens an incident when latest > 1.5× 7-day average and > $1', async () => {
    for (let i = 8; i >= 2; i--) await seed(`2026-05-${String(i).padStart(2, '0')}T00:00:00Z`, 1.0);
    await seed('2026-05-09T00:00:00Z', 5.0);
    await detectCostSpikes(new Date('2026-05-09T00:00:00Z'));
    const inc = await prisma.incident.findMany();
    expect(inc).toHaveLength(1);
    expect(inc[0].type).toBe('cost_spike');
  });

  it('does nothing when spike is below the $1 floor', async () => {
    for (let i = 8; i >= 2; i--) await seed(`2026-05-${String(i).padStart(2, '0')}T00:00:00Z`, 0.10);
    await seed('2026-05-09T00:00:00Z', 0.50);
    await detectCostSpikes(new Date('2026-05-09T00:00:00Z'));
    expect(await prisma.incident.count()).toBe(0);
  });

  it('does not duplicate an open incident', async () => {
    for (let i = 8; i >= 2; i--) await seed(`2026-05-${String(i).padStart(2, '0')}T00:00:00Z`, 1.0);
    await seed('2026-05-09T00:00:00Z', 5.0);
    await detectCostSpikes(new Date('2026-05-09T00:00:00Z'));
    await detectCostSpikes(new Date('2026-05-09T00:00:00Z'));
    expect(await prisma.incident.count()).toBe(1);
  });
});
