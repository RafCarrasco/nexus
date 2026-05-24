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
    billingAccountId: '000000-AAAAAA-BBBBBB',
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

  it('queries Cloud Billing for daily cost', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ amount: { units: '4', nanos: 250000000, currencyCode: 'USD' } }),
    });
    const cost = await FirebaseProvider.getDailyCost(conn, 'project:demo-proj', new Date('2026-05-22T00:00:00Z'));
    expect(cost).toEqual({ amount: 4.25, currency: 'USD', source: 'cloud-billing' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns null cost if billing API errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' });
    const cost = await FirebaseProvider.getDailyCost(conn, 'project:demo-proj', new Date());
    expect(cost).toBeNull();
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
});
