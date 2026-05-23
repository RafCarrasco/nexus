import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

export const FakeProvider: Provider = {
  type: 'fake',
  async listResources(conn: ConnectionView): Promise<ResourceDTO[]> {
    const n = (conn.config.resourceCount as number) ?? 3;
    return Array.from({ length: n }, (_, i) => ({
      externalId: `r-${i}`,
      name: `Fake Resource ${i}`,
      kind: 'fake-thing',
      region: 'nowhere',
      metadata: { index: i },
    }));
  },
  async getDailyCost(conn, _id, _date): Promise<CostDTO | null> {
    const amount = (conn.config.dailyCost as number) ?? 1.23;
    return { amount, currency: 'USD', source: 'fake' };
  },
  async getLastActivity(_conn, _id): Promise<Date | null> {
    return new Date('2026-05-23T00:00:00Z');
  },
  async getHealth(_conn, _id): Promise<HealthDTO> {
    return { status: 'ok' };
  },
  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },
};
