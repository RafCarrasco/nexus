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

  it('falls back to the tenants Firestore collection when there are no Auth tenants', async () => {
    listTenants.mockResolvedValue({ tenants: [] });
    fetchMock.mockImplementation((url: string) =>
      url.includes('/databases/(default)/documents/tenants')
        ? Promise.resolve({
            ok: true,
            json: async () => ({
              documents: [
                { name: 'projects/p/databases/(default)/documents/tenants/d1', fields: { name: { stringValue: 'PGDEMO1' } } },
                { name: 'projects/p/databases/(default)/documents/tenants/d2', fields: { name: { stringValue: 'PGDEMO2' } } },
              ],
            }),
          })
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    const t = await FirebaseProvider.listTenants(conn, 'project:demo-proj');
    expect(t).toEqual([
      { externalId: 'd1', displayName: 'PGDEMO1' },
      { externalId: 'd2', displayName: 'PGDEMO2' },
    ]);
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

// ── Deep service inventory (Frente A) ──────────────────────────────────────────

/** URL-routing fetch mock so call order doesn't matter. '403' body → 403 response. */
function routeFetch(routes: Array<[string, unknown]>) {
  return (url: string) => {
    for (const [needle, body] of routes) {
      if (url.includes(needle)) {
        if (body === '403') return Promise.resolve({ ok: false, status: 403 });
        return Promise.resolve({ ok: true, json: async () => body });
      }
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };
}

const FULL_ROUTES: Array<[string, unknown]> = [
  ['firebasehosting.googleapis.com', { sites: [] }],
  ['cloudfunctions.googleapis.com', { functions: [] }],
  [
    'serviceusage.googleapis.com',
    {
      services: [
        { config: { name: 'firestore.googleapis.com' } },
        { config: { name: 'firebasestorage.googleapis.com' } },
        { config: { name: 'identitytoolkit.googleapis.com' } },
      ],
    },
  ],
  [':listCollectionIds', { collectionIds: ['users', 'forms', 'submissions'] }],
  [
    '/databases',
    { databases: [{ name: 'projects/demo-proj/databases/(default)', locationId: 'nam5', type: 'FIRESTORE_NATIVE' }] },
  ],
  ['storage.googleapis.com', { items: [{ name: 'demo-proj.appspot.com', location: 'US', storageClass: 'STANDARD' }] }],
  [
    'firebasedatabase.googleapis.com',
    {
      instances: [
        {
          name: 'projects/demo-proj/locations/us-central1/instances/demo-proj-default-rtdb',
          state: 'ACTIVE',
          databaseUrl: 'https://demo-proj-default-rtdb.firebaseio.com',
        },
      ],
    },
  ],
  [
    'identitytoolkit.googleapis.com',
    {
      signIn: { email: { enabled: true }, anonymous: { enabled: false } },
      authorizedDomains: ['demo-proj.web.app'],
      mfa: { state: 'DISABLED' },
    },
  ],
];

describe('FirebaseProvider deep inventory', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    listUsersMock.mockResolvedValue({ users: [] });
  });

  it('discovers Firestore databases as firebase-firestore resources', async () => {
    fetchMock.mockImplementation(routeFetch(FULL_ROUTES));
    const r = await FirebaseProvider.listResources(conn);
    const fs = r.filter((x) => x.kind === 'firebase-firestore');
    expect(fs).toHaveLength(1);
    expect(fs[0]).toMatchObject({
      externalId: 'firestore:projects/demo-proj/databases/(default)',
      name: '(default)',
      metadata: expect.objectContaining({ locationId: 'nam5', type: 'FIRESTORE_NATIVE' }),
    });
    expect(fs[0].metadata.collectionIds).toEqual(['users', 'forms', 'submissions']);
  });

  it('discovers Storage buckets as firebase-storage-bucket resources', async () => {
    fetchMock.mockImplementation(routeFetch(FULL_ROUTES));
    const r = await FirebaseProvider.listResources(conn);
    const buckets = r.filter((x) => x.kind === 'firebase-storage-bucket');
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({
      externalId: 'storage:demo-proj.appspot.com',
      name: 'demo-proj.appspot.com',
      metadata: expect.objectContaining({ location: 'US', storageClass: 'STANDARD' }),
    });
  });

  it('discovers Realtime Database instances as firebase-rtdb resources', async () => {
    fetchMock.mockImplementation(routeFetch(FULL_ROUTES));
    const r = await FirebaseProvider.listResources(conn);
    const rtdb = r.filter((x) => x.kind === 'firebase-rtdb');
    expect(rtdb).toHaveLength(1);
    expect(rtdb[0]).toMatchObject({
      externalId: 'rtdb:projects/demo-proj/locations/us-central1/instances/demo-proj-default-rtdb',
      name: 'demo-proj-default-rtdb',
      metadata: expect.objectContaining({
        state: 'ACTIVE',
        databaseUrl: 'https://demo-proj-default-rtdb.firebaseio.com',
      }),
    });
  });

  it('builds serviceInventory on the project resource', async () => {
    fetchMock.mockImplementation(routeFetch(FULL_ROUTES));
    const r = await FirebaseProvider.listResources(conn);
    const project = r.find((x) => x.kind === 'firebase-project')!;
    const inv = project.metadata.serviceInventory as Array<{ key: string; enabled: boolean; headline?: string }>;
    expect(inv).toBeDefined();
    const fs = inv.find((i) => i.key === 'firestore')!;
    expect(fs.enabled).toBe(true);
    expect(fs.headline).toContain('banco');
    const storage = inv.find((i) => i.key === 'storage')!;
    expect(storage.enabled).toBe(true);
    const auth = inv.find((i) => i.key === 'auth')!;
    expect(auth.enabled).toBe(true);
  });

  it('degrades gracefully when every inventory API returns 403', async () => {
    fetchMock.mockImplementation(
      routeFetch([
        ['firebasehosting.googleapis.com', { sites: [] }],
        ['cloudfunctions.googleapis.com', { functions: [] }],
        ['serviceusage.googleapis.com', '403'],
        [':listCollectionIds', '403'],
        ['/databases', '403'],
        ['storage.googleapis.com', '403'],
        ['firebasedatabase.googleapis.com', '403'],
        ['identitytoolkit.googleapis.com', '403'],
      ]),
    );
    const r = await FirebaseProvider.listResources(conn);
    expect(r).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'firebase-project' })]));
    expect(r.some((x) => ['firebase-firestore', 'firebase-storage-bucket', 'firebase-rtdb'].includes(x.kind))).toBe(false);
  });

  it('reports unknown health for inventory resources (no spurious incidents)', async () => {
    const h = await FirebaseProvider.getHealth(conn, 'firestore:projects/demo-proj/databases/(default)');
    expect(h.status).toBe('unknown');
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it('project health: ok when Auth passes and Firestore is reachable (2xx)', async () => {
    listUsersMock.mockResolvedValue({ users: [] });
    fetchMock.mockImplementation(routeFetch([['firestore.googleapis.com', { databases: [] }]]));
    const h = await FirebaseProvider.getHealth(conn, 'project:demo-proj');
    expect(h.status).toBe('ok');
  });

  it('project health: ok when Firestore returns an expected 4xx (permission / API off)', async () => {
    // 403/404 on Firestore is EXPECTED for projects that don't use it — must NOT flip status.
    listUsersMock.mockResolvedValue({ users: [] });
    fetchMock.mockImplementation((url: string) =>
      url.includes('firestore.googleapis.com')
        ? Promise.resolve({ ok: false, status: 403 })
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    const h = await FirebaseProvider.getHealth(conn, 'project:demo-proj');
    expect(h.status).toBe('ok');
  });

  it('project health: degraded when Firestore returns 5xx', async () => {
    listUsersMock.mockResolvedValue({ users: [] });
    fetchMock.mockImplementation((url: string) =>
      url.includes('firestore.googleapis.com')
        ? Promise.resolve({ ok: false, status: 503 })
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    const h = await FirebaseProvider.getHealth(conn, 'project:demo-proj');
    expect(h.status).toBe('degraded');
    expect(h.message).toContain('Firestore');
  });

  it('project health: degraded when the Firestore probe throws (network/timeout)', async () => {
    listUsersMock.mockResolvedValue({ users: [] });
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('firestore.googleapis.com')) throw new Error('timeout');
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const h = await FirebaseProvider.getHealth(conn, 'project:demo-proj');
    expect(h.status).toBe('degraded');
  });

  it('project health: down when Auth itself fails (Firestore never reached)', async () => {
    listUsersMock.mockRejectedValue(new Error('auth boom'));
    fetchMock.mockImplementation(() => {
      throw new Error('SSRF: Firestore must not be probed when Auth is down');
    });
    const h = await FirebaseProvider.getHealth(conn, 'project:demo-proj');
    expect(h.status).toBe('down');
    expect(h.message).toContain('auth boom');
  });

  it('blocks SSRF: an internal hosting defaultUrl is not probed', async () => {
    const siteName = 'projects/demo-proj/sites/evil';
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('firebasehosting.googleapis.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sites: [{ name: siteName, defaultUrl: 'http://169.254.169.254/' }] }),
        });
      }
      if (url.includes('169.254.169.254')) throw new Error('SSRF: internal URL must not be probed');
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const h = await FirebaseProvider.getHealth(conn, `hosting:${siteName}`);
    expect(h.status).toBe('unknown');
    expect(h.message).toContain('unsafe');
  });
});
