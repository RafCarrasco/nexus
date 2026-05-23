export type ConnectionView = {
  id: string;
  type: string;
  /** Decrypted provider config (service account JSON, PAT, etc.) */
  config: Record<string, unknown>;
};

export type ResourceDTO = {
  externalId: string;
  name: string;
  kind: string;
  region?: string;
  metadata: Record<string, unknown>;
};

export type CostDTO = {
  amount: number;
  currency: string;
  source: string;
};

export type HealthDTO = {
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  message?: string;
};

export type TenantDTO = {
  externalId: string;
  displayName: string;
};

export interface Provider {
  readonly type: string;
  listResources(conn: ConnectionView): Promise<ResourceDTO[]>;
  getDailyCost(conn: ConnectionView, resourceExternalId: string, date: Date): Promise<CostDTO | null>;
  getLastActivity(conn: ConnectionView, resourceExternalId: string): Promise<Date | null>;
  getHealth(conn: ConnectionView, resourceExternalId: string): Promise<HealthDTO>;
  listTenants(conn: ConnectionView, resourceExternalId: string): Promise<TenantDTO[]>;
  /** Optional credential validation hook used at connection create time. */
  validate?(conn: ConnectionView): Promise<void>;
}
