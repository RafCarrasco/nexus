import { describe, it, expect } from 'vitest';
import { getProvider } from '@/providers/registry';

describe('FakeProvider', () => {
  it('is registered as "fake" and lists resources', async () => {
    const p = getProvider('fake');
    const conn = { id: 'c1', type: 'fake', config: { resourceCount: 2 } };
    const resources = await p.listResources(conn);
    expect(resources).toHaveLength(2);
    expect(resources[0].kind).toBe('fake-thing');
  });

  it('returns a cost in the expected range', async () => {
    const p = getProvider('fake');
    const conn = { id: 'c1', type: 'fake', config: { dailyCost: 12.5 } };
    const cost = await p.getDailyCost(conn, 'r-0', new Date('2026-05-22T00:00:00Z'));
    expect(cost?.amount).toBe(12.5);
    expect(cost?.currency).toBe('USD');
  });

  it('throws on unknown provider type', () => {
    expect(() => getProvider('does-not-exist')).toThrow(/unknown provider/);
  });
});
