import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { CloudflareProvider } from '@/providers/cloudflare';

const conn = {
  id: 'c',
  type: 'cloudflare',
  config: { token: 'cf-tok-xxx' },
};

const connWithAccount = {
  id: 'c2',
  type: 'cloudflare',
  config: { token: 'cf-tok-xxx', accountId: 'acc123' },
};

const fakeZone = {
  id: 'z1',
  name: 'example.com',
  status: 'active',
  modified_on: '2026-05-01T00:00:00Z',
  plan: { name: 'Free' },
};

describe('CloudflareProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('listResources emits zone resources', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [fakeZone] }),
    });
    const r = await CloudflareProvider.listResources(conn);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: 'z1',
      name: 'example.com',
      kind: 'cloudflare-zone',
      metadata: { name: 'example.com', status: 'active', plan: 'Free' },
    });
  });

  it('listResources emits worker resources when accountId set', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [fakeZone] }) }) // zones
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: [{ id: 'worker-one', created_on: '2026-04-01', modified_on: '2026-05-15' }],
        }),
      }); // workers
    const r = await CloudflareProvider.listResources(connWithAccount);
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({
      externalId: 'worker:worker-one',
      kind: 'cloudflare-worker',
    });
  });

  it('validate calls /user/tokens/verify and throws if not success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false }) });
    await expect(CloudflareProvider.validate!(conn)).rejects.toThrow();
  });

  it('validate passes on success:true', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    await expect(CloudflareProvider.validate!(conn)).resolves.toBeUndefined();
  });

  it('getHealth probes zone hostname', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const fakeResource = { metadata: { name: 'example.com' } };
    const h = await CloudflareProvider.getHealth(conn, 'z1', fakeResource as never);
    expect(h.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com', { method: 'HEAD' });
  });

  it('getHealth returns unknown for workers', async () => {
    const h = await CloudflareProvider.getHealth(conn, 'worker:worker-one');
    expect(h.status).toBe('unknown');
  });
});
