import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

const MGMT = 'https://management.azure.com';

type AzureConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId?: string;
};

function cfg(conn: ConnectionView): AzureConfig {
  return conn.config as unknown as AzureConfig;
}

async function azureAccessToken(conn: ConnectionView): Promise<string> {
  const { tenantId, clientId, clientSecret } = cfg(conn);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  if (!res.ok) throw new Error(`azure token ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type AzureSub = { subscriptionId: string; displayName: string; state: string };
type AzureApp = {
  id: string;
  name: string;
  kind?: string;
  location?: string;
  properties?: { defaultHostName?: string; kind?: string; state?: string };
};

export const AzureProvider: Provider = {
  type: 'azure',

  async listResources(conn): Promise<ResourceDTO[]> {
    const token = await azureAccessToken(conn);
    const headers = { Authorization: `Bearer ${token}` };
    const { subscriptionId } = cfg(conn);

    if (!subscriptionId) {
      const res = await fetch(`${MGMT}/subscriptions?api-version=2020-01-01`, { headers });
      if (!res.ok) throw new Error(`azure listResources (subscriptions) ${res.status}`);
      const data = (await res.json()) as { value: AzureSub[] };
      return data.value.map((s) => ({
        externalId: s.subscriptionId,
        name: s.displayName,
        kind: 'azure-subscription',
        metadata: { displayName: s.displayName, state: s.state },
      }));
    }

    // Enumerate App Services within subscription
    const url = `${MGMT}/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites?api-version=2022-03-01`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`azure listResources (sites) ${res.status}`);
    const data = (await res.json()) as { value: AzureApp[] };
    return data.value.map((app) => ({
      externalId: app.id,
      name: app.name,
      kind: 'azure-app-service',
      location: app.location,
      metadata: {
        defaultHostName: app.properties?.defaultHostName ?? null,
        kind: app.kind ?? app.properties?.kind ?? null,
        state: app.properties?.state ?? null,
        location: app.location ?? null,
      },
    }));
  },

  // Azure cost requires Cost Management API + heavier auth; out of MVP.
  async getDailyCost(_conn, _id, _date): Promise<CostDTO | null> {
    return null;
  },

  // No easy single endpoint for last activity on App Services.
  async getLastActivity(): Promise<Date | null> {
    return null;
  },

  async getHealth(_conn, _externalId, resource?: ResourceDTO): Promise<HealthDTO> {
    const meta = (resource as unknown as { metadata?: Record<string, unknown> } | undefined)?.metadata;
    const host = meta?.defaultHostName as string | undefined;
    if (!host) return { status: 'unknown', message: 'no defaultHostName in metadata' };
    try {
      const res = await fetch(`https://${host}`, { method: 'HEAD' });
      return res.ok ? { status: 'ok' } : { status: 'degraded', message: `http ${res.status}` };
    } catch (e) {
      return { status: 'degraded', message: (e as Error).message };
    }
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    // Acquiring a token is sufficient proof of valid credentials.
    await azureAccessToken(conn);
  },
};
