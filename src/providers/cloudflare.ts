import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

const API = 'https://api.cloudflare.com/client/v4';

function authHeaders(conn: ConnectionView): Record<string, string> {
  return { Authorization: `Bearer ${conn.config.token as string}` };
}

type CFZone = {
  id: string;
  name: string;
  status: string;
  modified_on?: string;
  plan?: { name?: string };
};

type CFWorkerScript = {
  id: string;
  created_on?: string;
  modified_on?: string;
};

export const CloudflareProvider: Provider = {
  type: 'cloudflare',

  async listResources(conn): Promise<ResourceDTO[]> {
    const resources: ResourceDTO[] = [];

    // Zones
    const zRes = await fetch(`${API}/zones?per_page=50`, { headers: authHeaders(conn) });
    if (!zRes.ok) throw new Error(`cloudflare listResources (zones) ${zRes.status}`);
    const zData = (await zRes.json()) as { result: CFZone[] };
    for (const z of zData.result) {
      resources.push({
        externalId: z.id,
        name: z.name,
        kind: 'cloudflare-zone',
        metadata: {
          name: z.name,
          status: z.status,
          plan: z.plan?.name ?? null,
          modified_on: z.modified_on ?? null,
        },
      });
    }

    // Workers (requires accountId)
    const accountId = conn.config.accountId as string | undefined;
    if (accountId) {
      const wRes = await fetch(`${API}/accounts/${accountId}/workers/scripts`, { headers: authHeaders(conn) });
      if (wRes.ok) {
        const wData = (await wRes.json()) as { result: CFWorkerScript[] };
        for (const s of wData.result) {
          resources.push({
            externalId: `worker:${s.id}`,
            name: s.id,
            kind: 'cloudflare-worker',
            metadata: {
              createdOn: s.created_on ?? null,
              modifiedOn: s.modified_on ?? null,
            },
          });
        }
      }
    }

    return resources;
  },

  // Cloudflare billing requires separate API; out of MVP.
  async getDailyCost(_conn, _id, _date): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(_conn, externalId, resource?: ResourceDTO): Promise<Date | null> {
    const meta = (resource as unknown as { metadata?: Record<string, unknown> } | undefined)?.metadata;
    if (externalId.startsWith('worker:') && meta?.modifiedOn) {
      return new Date(meta.modifiedOn as string);
    }
    if (!externalId.startsWith('worker:') && meta?.modified_on) {
      return new Date(meta.modified_on as string);
    }
    return null;
  },

  async getHealth(_conn, externalId, resource?: ResourceDTO): Promise<HealthDTO> {
    if (externalId.startsWith('worker:')) {
      // No probe for workers
      return { status: 'unknown', message: 'workers have no health probe' };
    }
    const meta = (resource as unknown as { metadata?: Record<string, unknown> } | undefined)?.metadata;
    const zoneName = meta?.name as string | undefined;
    if (!zoneName) return { status: 'unknown', message: 'no zone name in metadata' };
    try {
      const res = await fetch(`https://${zoneName}`, { method: 'HEAD' });
      return res.ok ? { status: 'ok' } : { status: 'degraded', message: `http ${res.status}` };
    } catch (e) {
      return { status: 'degraded', message: (e as Error).message };
    }
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetch(`${API}/user/tokens/verify`, { headers: authHeaders(conn) });
    const data = (await res.json()) as { success: boolean };
    if (!res.ok || !data.success) throw new Error(`cloudflare validate: token invalid (${res.status})`);
  },
};
