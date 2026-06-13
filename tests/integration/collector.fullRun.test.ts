import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/db/client';
import { encrypt } from '@/crypto/vault';
import { runAll } from '@/collector/runAll';

process.env.NEXUS_MASTER_KEY ??= Buffer.alloc(32, 7).toString('base64');

async function cleanup() {
  await prisma.incident.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.costSnapshot.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(cleanup);
beforeEach(cleanup);

describe('runAll', () => {
  it('processes multiple connections and tolerates one failing', async () => {
    const u = await prisma.user.create({ data: { email: 'x@procurementgarage.com' } });
    await prisma.connection.create({
      data: { name: 'good', type: 'fake', ownerUserId: u.id, credentials: encrypt({ resourceCount: 2 }) },
    });
    await prisma.connection.create({
      data: { name: 'bad', type: 'bogus', ownerUserId: u.id, credentials: encrypt({}) },
    });
    await runAll();

    const good = await prisma.connection.findFirstOrThrow({ where: { name: 'good' } });
    const bad = await prisma.connection.findFirstOrThrow({ where: { name: 'bad' } });
    expect(good.status).toBe('active');
    expect(bad.status).toBe('error');

    const goodResources = await prisma.resource.findMany({ where: { connectionId: good.id } });
    expect(goodResources).toHaveLength(2);
    const incidents = await prisma.incident.findMany();
    expect(incidents.some((i) => i.type === 'collection_failed')).toBe(true);
  });
});
