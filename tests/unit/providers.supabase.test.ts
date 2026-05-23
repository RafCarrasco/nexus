import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { SupabaseProvider } from '@/providers/supabase';

const conn = {
  id: 'c',
  type: 'supabase',
  config: { token: 'sbp_xxx', orgSlug: 'pg-org' },
};

describe('SupabaseProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('lists projects as resources', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'p1', name: 'proj-one', region: 'us-east-1' },
        { id: 'p2', name: 'proj-two', region: 'eu-west-1' },
      ],
    });
    const r = await SupabaseProvider.listResources(conn);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ externalId: 'p1', kind: 'supabase-project', region: 'us-east-1' });
  });

  it('returns daily cost from billing usage', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ usage: [{ date: '2026-05-22', total_amount: 1.75, currency: 'USD' }] }),
    });
    const cost = await SupabaseProvider.getDailyCost(conn, 'p1', new Date('2026-05-22T00:00:00Z'));
    expect(cost).toEqual({ amount: 1.75, currency: 'USD', source: 'supabase-billing' });
  });

  it('returns ok health on 200', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) });
    const h = await SupabaseProvider.getHealth(conn, 'p1');
    expect(h.status).toBe('ok');
  });

  it('returns down health on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'bad' });
    const h = await SupabaseProvider.getHealth(conn, 'p1');
    expect(h.status).toBe('down');
  });
});
