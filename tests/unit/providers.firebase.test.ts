import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTenants, initializeAppMock, accessTokenMock } = vi.hoisted(() => ({
  listTenants: vi.fn(),
  initializeAppMock: vi.fn(),
  accessTokenMock: vi.fn().mockResolvedValue({ token: 'fake-token' }),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  cert: (json: unknown) => ({ __cert: json }),
  getApps: () => [],
  deleteApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
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
  });

  it('lists the project itself as a resource', async () => {
    const r = await FirebaseProvider.listResources(conn);
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'project:demo-proj', kind: 'firebase-project' }),
      ]),
    );
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

  it('lists auth tenants', async () => {
    listTenants.mockResolvedValue({ tenants: [{ tenantId: 't1', displayName: 'Acme' }] });
    const t = await FirebaseProvider.listTenants(conn, 'project:demo-proj');
    expect(t).toEqual([{ externalId: 't1', displayName: 'Acme' }]);
  });
});
