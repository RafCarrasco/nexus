import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { VercelProvider } from '@/providers/vercel';

const conn = {
  id: 'c',
  type: 'vercel',
  config: { token: 'ver_tok_xxx' },
};

const connWithTeam = {
  id: 'c2',
  type: 'vercel',
  config: { token: 'ver_tok_xxx', teamId: 'team_abc' },
};

describe('VercelProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('listResources maps projects to ResourceDTOs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: [
          { id: 'p1', name: 'my-app', framework: 'nextjs', targets: { production: { alias: ['my-app.vercel.app'] } } },
          { id: 'p2', name: 'other', framework: null },
        ],
      }),
    });
    const r = await VercelProvider.listResources(conn);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      externalId: 'p1',
      name: 'my-app',
      kind: 'vercel-project',
      metadata: { framework: 'nextjs', productionUrl: 'my-app.vercel.app' },
    });
    expect(r[1].metadata.productionUrl).toBeNull();
  });

  it('listResources appends teamId to URL when provided', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ projects: [] }) });
    await VercelProvider.listResources(connWithTeam);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('teamId=team_abc'),
      expect.any(Object),
    );
  });

  it('validate calls /v2/user', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: {} }) });
    await expect(VercelProvider.validate!(conn)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v2/user'),
      expect.any(Object),
    );
  });

  it('validate throws on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(VercelProvider.validate!(conn)).rejects.toThrow('401');
  });

  it('getHealth returns ok for 2xx productionUrl', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const fakeResource = { metadata: { productionUrl: 'my-app.vercel.app' } };
    const h = await VercelProvider.getHealth(conn, 'p1', fakeResource as never);
    expect(h.status).toBe('ok');
  });

  it('getHealth returns unknown when no productionUrl', async () => {
    const h = await VercelProvider.getHealth(conn, 'p1', { metadata: {} } as never);
    expect(h.status).toBe('unknown');
  });

  it('getDailyCost always returns null', async () => {
    const c = await VercelProvider.getDailyCost(conn, 'p1', new Date());
    expect(c).toBeNull();
  });
});
