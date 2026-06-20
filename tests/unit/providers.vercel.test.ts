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

  it('getHealth fetches the project fresh and returns ok for a 2xx production domain', async () => {
    // 1st fetch: GET /v9/projects/p1 → production alias; 2nd fetch: HEAD probe → 2xx
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'p1', name: 'my-app', targets: { production: { alias: ['my-app.vercel.app'] } } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const h = await VercelProvider.getHealth(conn, 'p1');
    expect(h.status).toBe('ok');
    expect(fetchMock.mock.calls[0][0]).toContain('/v9/projects/p1');
  });

  it('getHealth ignores a stale metadata productionUrl and uses the fresh API domain', async () => {
    // Even with a stale injected resource, the fresh API domain is what gets probed.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'p1', targets: { production: { alias: ['fresh.vercel.app'] } } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 }); // probe degraded
    const stale = { metadata: { productionUrl: 'stale.vercel.app' } };
    const h = await VercelProvider.getHealth(conn, 'p1', stale as never);
    // probed the fresh domain (degraded), not the stale 'ok' one
    expect(h.status).toBe('degraded');
    expect(fetchMock.mock.calls[1][0]).toContain('fresh.vercel.app');
  });

  it('getHealth returns unknown when the project has no production deployment', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', name: 'no-prod' }),
    });
    const h = await VercelProvider.getHealth(conn, 'p1', { metadata: {} } as never);
    expect(h.status).toBe('unknown');
    expect(h.message).toContain('produção');
  });

  it('getHealth is down when the projects API returns 401/403 (token)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    const h = await VercelProvider.getHealth(conn, 'p1');
    expect(h.status).toBe('down');
    expect(h.message).toContain('token');
  });

  it('getHealth degrades when the projects API returns another non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const h = await VercelProvider.getHealth(conn, 'p1');
    expect(h.status).toBe('degraded');
    expect(h.message).toContain('500');
  });

  it('getHealth passes teamId to the projects API when configured', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await VercelProvider.getHealth(connWithTeam, 'p1');
    expect(fetchMock.mock.calls[0][0]).toContain('teamId=team_abc');
  });

  it('getDailyCost always returns null', async () => {
    const c = await VercelProvider.getDailyCost(conn, 'p1', new Date());
    expect(c).toBeNull();
  });
});
