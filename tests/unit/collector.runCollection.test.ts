import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/db/client';
import { runCollection } from '@/collector/runCollection';
import { encrypt } from '@/crypto/vault';

process.env.NEXUS_MASTER_KEY ??= Buffer.alloc(32, 7).toString('base64');

async function cleanup() {
  await prisma.incident.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.user.deleteMany();
}

let userId: string;

beforeAll(async () => {
  await cleanup();
  const u = await prisma.user.create({ data: { email: 'test@procurementgarage.com', role: 'admin' } });
  userId = u.id;
});

beforeEach(cleanup);

describe('runCollection (fake provider)', () => {
  it('upserts resources and activity log', async () => {
    const conn = await prisma.connection.create({
      data: {
        name: 'fake conn',
        type: 'fake',
        ownerUserId: userId,
        credentials: encrypt({ resourceCount: 3 }),
      },
    });
    await runCollection(conn.id);
    const resources = await prisma.resource.findMany({ where: { connectionId: conn.id } });
    expect(resources).toHaveLength(3);
    const activity = await prisma.activityLog.findMany();
    expect(activity).toHaveLength(3);
    expect(activity[0].lastSeenAt).not.toBeNull();
  });

  it('marks connection error and opens incident on provider failure', async () => {
    const conn = await prisma.connection.create({
      data: {
        name: 'bad conn',
        type: 'does-not-exist',
        ownerUserId: userId,
        credentials: encrypt({}),
      },
    });
    await runCollection(conn.id);
    const after = await prisma.connection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(after.status).toBe('error');
    const incidents = await prisma.incident.findMany();
    expect(incidents[0].type).toBe('collection_failed');
  });
});
