import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { N8nProvider } from '@/providers/n8n';

const conn = {
  id: 'c',
  type: 'n8n',
  config: { baseUrl: 'https://n8n.example.com', apiKey: 'n8n_api_test' },
};

describe('N8nProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('listResources parses workflows correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '42',
            name: 'My Workflow',
            active: true,
            tags: [{ name: 'prod' }],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
            nodes: [{}, {}],
          },
          {
            id: '43',
            name: 'Another Workflow',
            active: false,
            tags: [],
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-06-02T00:00:00.000Z',
            nodes: [],
          },
        ],
      }),
    });

    const resources = await N8nProvider.listResources(conn);
    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({
      externalId: 'workflow:42',
      name: 'My Workflow',
      kind: 'n8n-workflow',
      metadata: { active: true, tags: ['prod'], nodeCount: 2 },
    });
    expect(resources[1]).toMatchObject({
      externalId: 'workflow:43',
      name: 'Another Workflow',
      kind: 'n8n-workflow',
      metadata: { active: false, tags: [], nodeCount: 0 },
    });
  });

  it('getHealth returns degraded when 1 error in last 5 executions', async () => {
    // First fetch: workflow detail
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '42', name: 'My Workflow', active: true }),
    });
    // Second fetch: executions
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'e1', status: 'success', startedAt: '2026-06-01T10:00:00.000Z' },
          { id: 'e2', status: 'error', startedAt: '2026-05-31T09:00:00.000Z' },
          { id: 'e3', status: 'success', startedAt: '2026-05-30T08:00:00.000Z' },
          { id: 'e4', status: 'success', startedAt: '2026-05-29T07:00:00.000Z' },
          { id: 'e5', status: 'success', startedAt: '2026-05-28T06:00:00.000Z' },
        ],
      }),
    });

    const health = await N8nProvider.getHealth(conn, 'workflow:42');
    expect(health.status).toBe('degraded');
  });

  it('validate throws on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(N8nProvider.validate!(conn)).rejects.toThrow('n8n validate 401');
  });
});
