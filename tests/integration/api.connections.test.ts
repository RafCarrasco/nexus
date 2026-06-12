import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { prisma } from '@/db/client';
import { encrypt } from '@/crypto/vault';

process.env.NEXUS_MASTER_KEY ??= Buffer.alloc(32, 7).toString('base64');

// Stub the auth() helper to always return a fake admin session.
vi.mock('@/auth/config', () => ({
  auth: async () => ({ user: { id: 'admin-id', email: 'admin@procurementgarage.com', role: 'admin' } }),
  authOrE2E: async () => ({ user: { id: 'admin-id', email: 'admin@procurementgarage.com', role: 'admin' } }),
  handlers: { GET: async () => new Response(), POST: async () => new Response() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { POST as createConnection, GET as listConnections } from '@/app/api/connections/route';

beforeAll(async () => {
  await prisma.connection.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: 'admin-id', email: 'admin@procurementgarage.com', role: 'admin' } });
});

beforeEach(async () => {
  await prisma.connection.deleteMany();
  await prisma.auditLog.deleteMany();
});

describe('connections API', () => {
  it('creates a fake connection (validates via FakeProvider)', async () => {
    const req = new Request('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Fakey', type: 'fake', config: { resourceCount: 1 } }),
    });
    const res = await createConnection(req);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const row = await prisma.connection.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe('Fakey');
    expect(row.credentials.length).toBeGreaterThan(28);
  });

  it('rejects unknown provider type', async () => {
    const req = new Request('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', type: 'mystery', config: {} }),
    });
    const res = await createConnection(req);
    expect(res.status).toBe(400);
  });

  it('lists connections without exposing credentials', async () => {
    await prisma.connection.create({
      data: { name: 'visible', type: 'fake', ownerUserId: 'admin-id', credentials: encrypt({}) },
    });
    const res = await listConnections(new Request('http://localhost/api/connections'));
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty('credentials');
  });
});
