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

// ── Agent observability (Frente B) ─────────────────────────────────────────────

import { sumTokenUsage, findModelName, analyzeWorkflow } from '@/providers/n8n';

function routeFetch(routes: Array<[string, unknown]>) {
  return (url: unknown) => {
    const u = typeof url === 'string' ? url : '';
    for (const [needle, body] of routes) {
      if (u.includes(needle)) {
        if (body === '404') return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, json: async () => body });
      }
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };
}

describe('sumTokenUsage', () => {
  it('sums totalTokens nested in an n8n execution payload, ignoring prompt/completion', () => {
    const payload = {
      data: {
        resultData: {
          runData: {
            'AI Agent': [
              { data: { ai: [[{ json: { tokenUsage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 } } }]] } },
            ],
          },
        },
      },
    };
    expect(sumTokenUsage(payload)).toBe(1500);
  });

  it('returns 0 for payloads with no token fields', () => {
    expect(sumTokenUsage({ a: { b: 1 }, c: 'x' })).toBe(0);
  });
});

describe('analyzeWorkflow', () => {
  it('classifies trigger, services, AI nodes and error handling', () => {
    const f = analyzeWorkflow([
      { type: 'n8n-nodes-base.webhook' },
      { type: 'n8n-nodes-base.httpRequest' },
      { type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
      { type: 'n8n-nodes-base.slack', continueOnFail: true },
    ]);
    expect(f.trigger).toBe('webhook');
    expect(f.services).toEqual(expect.arrayContaining(['Webhook', 'HTTP', 'IA', 'Slack']));
    expect(f.aiNodeCount).toBe(1);
    expect(f.nodeCount).toBe(4);
    expect(f.hasErrorHandling).toBe(true);
  });

  it('detects schedule trigger and no error handling', () => {
    const f = analyzeWorkflow([
      { type: 'n8n-nodes-base.scheduleTrigger' },
      { type: 'n8n-nodes-base.set' },
    ]);
    expect(f.trigger).toBe('schedule');
    expect(f.aiNodeCount).toBe(0);
    expect(f.hasErrorHandling).toBe(false);
  });

  it('handles empty workflow', () => {
    expect(analyzeWorkflow([])).toMatchObject({ trigger: 'none', nodeCount: 0, services: [] });
  });
});

describe('findModelName', () => {
  it('finds a model name nested in an execution payload', () => {
    const payload = { runData: { agent: [{ options: { model: 'gpt-4o-mini' } }] } };
    expect(findModelName(payload)).toBe('gpt-4o-mini');
  });

  it('ignores non-model strings under model-ish keys', () => {
    expect(findModelName({ model: 'a generic label' })).toBeUndefined();
    expect(findModelName({ nothing: 'here' })).toBeUndefined();
  });
});

describe('N8nProvider agent stats', () => {
  beforeEach(() => fetchMock.mockReset());

  it('enriches active workflows with execStats and recentTokens', async () => {
    fetchMock.mockImplementation(
      routeFetch([
        ['/workflows?limit=250', { data: [{ id: '42', name: 'Agent WF', active: true, tags: [], nodes: [{}] }] }],
        ['includeData=true', { data: { runData: { n: [{ json: { tokenUsage: { totalTokens: 1500 } } }] } } }],
        ['status=success', { data: [{ id: 'e1', status: 'success' }] }],
        [
          'limit=50',
          {
            data: [
              { id: 'e1', status: 'success', startedAt: '2026-06-01T10:00:00.000Z', stoppedAt: '2026-06-01T10:00:02.000Z' },
              { id: 'e2', status: 'error', startedAt: '2026-06-01T09:00:00.000Z' },
              { id: 'e3', status: 'success', startedAt: '2026-06-01T08:00:00.000Z', stoppedAt: '2026-06-01T08:00:04.000Z' },
              { id: 'e4', status: 'success', startedAt: '2026-06-01T07:00:00.000Z', stoppedAt: '2026-06-01T07:00:06.000Z' },
            ],
          },
        ],
      ]),
    );

    const resources = await N8nProvider.listResources(conn);
    expect(resources).toHaveLength(1);
    const stats = resources[0].metadata.execStats as Record<string, unknown>;
    expect(stats).toMatchObject({ window: 4, success: 3, error: 1, errorRate: 0.25, avgDurationMs: 4000 });
    expect(stats.lastErrorAt).toBe('2026-06-01T09:00:00.000Z');
    expect(resources[0].metadata.recentTokens).toBe(1500);
  });

  it('skips stats/token calls for inactive workflows (single fetch)', async () => {
    fetchMock.mockImplementation(
      routeFetch([['/workflows?limit=250', { data: [{ id: '99', name: 'Off', active: false, nodes: [] }] }]]),
    );
    const resources = await N8nProvider.listResources(conn);
    expect(resources[0].metadata.execStats).toBeUndefined();
    expect(resources[0].metadata.recentTokens).toBeUndefined();
    // No executions endpoint should be hit for an inactive workflow.
    const hitExecutions = fetchMock.mock.calls.some(
      (c) => typeof c[0] === 'string' && c[0].includes('/executions'),
    );
    expect(hitExecutions).toBe(false);
  });

  it('getHealth is down when the recent error rate is high', async () => {
    fetchMock.mockImplementation(
      routeFetch([
        ['/workflows/42', { id: '42', active: true }],
        [
          'limit=20',
          {
            data: [
              { id: 'a', status: 'error', startedAt: '2026-06-01T03:00:00.000Z' },
              { id: 'b', status: 'error', startedAt: '2026-06-01T02:00:00.000Z' },
              { id: 'c', status: 'success', startedAt: '2026-06-01T01:00:00.000Z' },
            ],
          },
        ],
      ]),
    );
    const h = await N8nProvider.getHealth(conn, 'workflow:42');
    expect(h.status).toBe('down'); // 2/3 ≈ 67% >= 50%
  });
});
