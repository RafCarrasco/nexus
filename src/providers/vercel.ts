import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

const API = 'https://api.vercel.com';

function authHeaders(conn: ConnectionView): Record<string, string> {
  return { Authorization: `Bearer ${conn.config.token as string}` };
}

type VercelProject = {
  id: string;
  name: string;
  framework?: string | null;
  targets?: { production?: { alias?: string[] } };
};

type VercelDeployment = {
  created: number;
};

export const VercelProvider: Provider = {
  type: 'vercel',

  async listResources(conn): Promise<ResourceDTO[]> {
    const teamId = conn.config.teamId as string | undefined;
    const url = teamId ? `${API}/v9/projects?teamId=${teamId}` : `${API}/v9/projects`;
    const res = await fetch(url, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`vercel listResources ${res.status}`);
    const data = (await res.json()) as { projects: VercelProject[] };
    return data.projects.map((p) => ({
      externalId: p.id,
      name: p.name,
      kind: 'vercel-project',
      metadata: {
        framework: p.framework ?? null,
        productionUrl: p.targets?.production?.alias?.[0] ?? null,
      },
    }));
  },

  // Vercel doesn't expose daily cost via public API.
  async getDailyCost(_conn, _id, _date): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(conn, externalId): Promise<Date | null> {
    const url = `${API}/v6/deployments?projectId=${externalId}&limit=1`;
    const res = await fetch(url, { headers: authHeaders(conn) });
    if (!res.ok) return null;
    const data = (await res.json()) as { deployments: VercelDeployment[] };
    const first = data.deployments[0];
    return first ? new Date(first.created) : null;
  },

  async getHealth(_conn, _externalId, resource?: ResourceDTO): Promise<HealthDTO> {
    // Called by collector with resource metadata available via a workaround:
    // provider receives externalId; we can't get productionUrl from it alone.
    // Collector must pass the resource; use metadata if injected. Fallback: unknown.
    const url = (resource as unknown as { metadata?: { productionUrl?: unknown } } | undefined)?.metadata?.productionUrl;
    if (typeof url !== 'string' || !url) return { status: 'unknown', message: 'no productionUrl' };
    try {
      const res = await fetch(`https://${url}`, { method: 'HEAD' });
      return res.ok ? { status: 'ok' } : { status: 'degraded', message: `http ${res.status}` };
    } catch (e) {
      return { status: 'degraded', message: (e as Error).message };
    }
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetch(`${API}/v2/user`, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`vercel validate: invalid token (${res.status})`);
  },
};
