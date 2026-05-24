import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTenants, initializeAppMock, accessTokenMock, listUsersMock } = vi.hoisted(() => ({
  listTenants: vi.fn(),
  initializeAppMock: vi.fn(),
  accessTokenMock: vi.fn().mockResolvedValue({ token: 'fake-token' }),
  listUsersMock: vi.fn().mockResolvedValue({ users: [] }),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  cert: (json: unknown) => ({ __cert: json }),
  getApps: () => [],
  deleteApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    tenantManager: () => ({
      listTenants: () => listTenants(),
    }),
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(function () {
    return { getAccessToken: () => accessTokenMock() };
  }),
}));

import { FirebaseProvider } from '@/providers/firebase';

const conn = {
  id: 'c',
  type: 'firebase',
  config: {
    serviceAccount: { project_id: 'demo-proj', client_email: 'x@y', private_key: 'k' },
  },
};

describe('FirebaseProvider', () => {
  beforeEach(() => {
    listTenants.mockReset();
    fetchMock.mockReset();
    initializeAppMock.mockClear();
    listUsersMock.mockResolvedValue({ users: [] });
  });

  it('lists the project itself as a resource', async () => {
    // No hosting sites
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sites: [] }) });
    const r = await FirebaseProvider.listResources(conn);
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'project:demo-proj', kind: 'firebase-project' }),
      ]),
    );
  });

  it('lists hosting sites as firebase-hosting resources', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sites: [
          { name: 'projects/demo-proj/sites/demo-proj', defaultUrl: 'https://demo-proj.web.app', appId: 'app-1' },
        ],
      }),
    });
    const r = await FirebaseProvider.listResources(conn);
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: 'hosting:projects/demo-proj/sites/demo-proj',
          kind: 'firebase-hosting',
          metadata: expect.objectContaining({ defaultUrl: 'https://demo-proj.web.app' }),
        }),
      ]),
    );
  });

  it('handles hosting API failure gracefully', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const r = await FirebaseProvider.listResources(conn);
    // Should still have project resource
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'project:demo-proj' }),
      ]),
    );
    // Should NOT throw
    expect(r.some((x) => x.kind === 'firebase-hosting')).toBe(false);
  });

  it('queries Cloud Monitoring for daily cost', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        timeSeries: [
          {
            metric: { labels: { currency: 'USD' } },
            points: [{ value: { doubleValue: 4.25 } }],
          },
        ],
      }),
    });
    const cost = await FirebaseProvider.getDailyCost(conn, 'project:demo-proj', new Date('2026-05-22T00:00:00Z'));
    expect(cost).toEqual({ amount: 4.25, currency: 'USD', source: 'cloud-monitoring' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns null cost if monitoring API errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const cost = await FirebaseProvider.getDailyCost(conn, 'project:demo-proj', new Date());
    expect(cost).toBeNull();
  });

  it('returns null cost for non-project resources', async () => {
    const cost = await FirebaseProvider.getDailyCost(conn, 'hosting:projects/demo-proj/sites/x', new Date());
    expect(cost).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists Cloud Functions as firebase-function resources', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sites: [] }) }) // hosting
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          functions: [
            {
              name: 'projects/demo-proj/locations/us-central1/functions/myFn',
              state: 'ACTIVE',
              buildConfig: { runtime: 'nodejs20', entryPoint: 'myFn' },
              serviceConfig: { uri: 'https://my-fn.run.app' },
            },
            {
              name: 'projects/demo-proj/locations/us-central1/functions/otherFn',
              state: 'ACTIVE',
              buildConfig: { runtime: 'nodejs20', entryPoint: 'otherFn' },
            },
          ],
        }),
      });
    const r = await FirebaseProvider.listResources(conn);
    const fns = r.filter((x) => x.kind === 'firebase-function');
    expect(fns).toHaveLength(2);
    expect(fns[0]).toMatchObject({
      externalId: 'function:projects/demo-proj/locations/us-central1/functions/myFn',
      name: 'myFn',
      kind: 'firebase-function',
      metadata: expect.objectContaining({ state: 'ACTIVE', url: 'https://my-fn.run.app' }),
    });
  });

  it('handles functions API failure gracefully', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sites: [] }) }) // hosting
      .mockResolvedValueOnce({ ok: false, status: 403 }); // functions 403
    const r = await FirebaseProvider.listResources(conn);
    expect(r.some((x) => x.kind === 'firebase-function')).toBe(false);
    expect(r).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'firebase-project' })]));
  });

  it('lists auth tenants for project resource', async () => {
    listTenants.mockResolvedValue({ tenants: [{ tenantId: 't1', displayName: 'Acme' }] });
    const t = await FirebaseProvider.listTenants(conn, 'project:demo-proj');
    expect(t).toEqual([{ externalId: 't1', displayName: 'Acme' }]);
  });

  it('returns no tenants for hosting resources', async () => {
    const t = await FirebaseProvider.listTenants(conn, 'hosting:projects/demo-proj/sites/demo-proj');
    expect(t).toEqual([]);
    expect(listTenants).not.toHaveBeenCalled();
  });

  it('uses BigQuery when bigQueryDataset is set', async () => {
    const bqConn = {
      ...conn,
      config: {
        serviceAccount: { project_id: 'demo-proj', client_email: 'x@y', private_key: 'k' },
        billingAccountId: 'ABC123-DEF456-GHI789',
        bigQueryDataset: 'billing_export',
        bigQueryProject: 'demo-proj',
      },
    };
    // fetch: BigQuery queries endpoint returns rows
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [
          { f: [{ v: 'Cloud Firestore' }, { v: '3.50' }, { v: 'USD' }] },
          { f: [{ v: 'Cloud Functions' }, { v: '1.25' }, { v: 'USD' }] },
        ],
      }),
    });
    const cost = await FirebaseProvider.getDailyCost(bqConn, 'project:demo-proj', new Date('2026-05-22T00:00:00Z'));
    expect(cost).not.toBeNull();
    expect(cost!.amount).toBeCloseTo(4.75);
    expect(cost!.currency).toBe('USD');
    expect(cost!.source).toBe('bigquery');
    expect((cost as { breakdown?: unknown[] }).breakdown).toHaveLength(2);
    expect((cost as { breakdown?: Array<{ service: string; amount: number }> }).breakdown![0]).toMatchObject({
      service: 'Cloud Firestore',
      amount: 3.50,
    });
    // Should have called BigQuery endpoint, not Monitoring
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('bigquery.googleapis.com');
  });

  it('falls back to Monitoring when bigQueryDataset is missing', async () => {
    // conn has no bigQueryDataset — should hit Monitoring
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        timeSeries: [
          {
            metric: { labels: { currency: 'USD' } },
            points: [{ value: { doubleValue: 2.00 } }],
          },
        ],
      }),
    });
    const cost = await FirebaseProvider.getDailyCost(conn, 'project:demo-proj', new Date('2026-05-22T00:00:00Z'));
    expect(cost).toEqual({ amount: 2.00, currency: 'USD', source: 'cloud-monitoring' });
    expect(fetchMock.mock.calls[0][0]).toContain('monitoring.googleapis.com');
  });
});
