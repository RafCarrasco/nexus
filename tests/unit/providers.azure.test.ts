import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { AzureProvider } from '@/providers/azure';

const conn = {
  id: 'c',
  type: 'azure',
  config: { tenantId: 'tid', clientId: 'cid', clientSecret: 'sec' },
};

const connWithSub = {
  id: 'c2',
  type: 'azure',
  config: { tenantId: 'tid', clientId: 'cid', clientSecret: 'sec', subscriptionId: 'sub-123' },
};

const tokenResponse = { access_token: 'az-token' };

describe('AzureProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('listResources without subscriptionId lists subscriptions', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => tokenResponse }) // token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ subscriptionId: 's1', displayName: 'My Sub', state: 'Enabled' }],
        }),
      });
    const r = await AzureProvider.listResources(conn);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: 's1',
      kind: 'azure-subscription',
      metadata: { displayName: 'My Sub', state: 'Enabled' },
    });
  });

  it('listResources with subscriptionId lists App Services', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => tokenResponse }) // token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: '/subs/sub-123/sites/app1',
              name: 'app1',
              kind: 'app',
              location: 'eastus',
              properties: { defaultHostName: 'app1.azurewebsites.net', state: 'Running' },
            },
          ],
        }),
      });
    const r = await AzureProvider.listResources(connWithSub);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: '/subs/sub-123/sites/app1',
      name: 'app1',
      kind: 'azure-app-service',
      metadata: { defaultHostName: 'app1.azurewebsites.net', state: 'Running' },
    });
  });

  it('validate succeeds when token acquired', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => tokenResponse });
    await expect(AzureProvider.validate!(conn)).resolves.toBeUndefined();
  });

  it('validate throws on token failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(AzureProvider.validate!(conn)).rejects.toThrow('401');
  });

  it('getHealth probes defaultHostName', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const fakeResource = { metadata: { defaultHostName: 'app1.azurewebsites.net' } };
    const h = await AzureProvider.getHealth(conn, '/subs/s/sites/app1', fakeResource as never);
    expect(h.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('https://app1.azurewebsites.net', { method: 'HEAD' });
  });

  it('getHealth returns unknown with no hostname', async () => {
    const h = await AzureProvider.getHealth(conn, 'x', { metadata: {} } as never);
    expect(h.status).toBe('unknown');
  });

  it('getDailyCost always returns null', async () => {
    const c = await AzureProvider.getDailyCost(conn, 'x', new Date());
    expect(c).toBeNull();
  });
});
