import { fetchWithTimeout, probePublicUrl } from '@/lib/http';
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

/**
 * Most recent production deployment time for a project (best-effort). The /v9/projects
 * list doesn't carry a deploy timestamp, so we hit /v6/deployments scoped to the project
 * and the production target, limit 1. Returns the ISO string of deployments[0].created
 * (epoch ms), or undefined on any failure / no deployment — never throws, so a denied or
 * slow call can't break listResources.
 */
async function getLastProductionDeployIso(
  conn: ConnectionView,
  projectId: string,
  teamId: string | undefined,
): Promise<string | undefined> {
  try {
    const q = new URLSearchParams({ projectId, limit: '1', target: 'production' });
    if (teamId) q.set('teamId', teamId);
    const res = await fetchWithTimeout(`${API}/v6/deployments?${q}`, { headers: authHeaders(conn) });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { deployments?: VercelDeployment[] };
    const created = data.deployments?.[0]?.created;
    return typeof created === 'number' ? new Date(created).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

export const VercelProvider: Provider = {
  type: 'vercel',

  async listResources(conn): Promise<ResourceDTO[]> {
    const teamId = conn.config.teamId as string | undefined;
    const url = teamId ? `${API}/v9/projects?teamId=${teamId}` : `${API}/v9/projects`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`vercel listResources ${res.status}`);
    const data = (await res.json()) as { projects: VercelProject[] };
    // Per-project last production deploy time — best-effort, concurrent. Omitted from
    // metadata when unavailable (no null garbage).
    return Promise.all(
      data.projects.map(async (p) => {
        const lastDeployAt = await getLastProductionDeployIso(conn, p.id, teamId);
        return {
          externalId: p.id,
          name: p.name,
          kind: 'vercel-project',
          metadata: {
            framework: p.framework ?? null,
            productionUrl: p.targets?.production?.alias?.[0] ?? null,
            ...(lastDeployAt ? { lastDeployAt } : {}),
          },
        };
      }),
    );
  },

  // Vercel doesn't expose daily cost via public API.
  async getDailyCost(_conn, _id, _date): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(conn, externalId): Promise<Date | null> {
    const url = `${API}/v6/deployments?projectId=${externalId}&limit=1`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) return null;
    const data = (await res.json()) as { deployments: VercelDeployment[] };
    const first = data.deployments[0];
    return first ? new Date(first.created) : null;
  },

  async getHealth(conn, externalId, resource?: ResourceDTO): Promise<HealthDTO> {
    // Fetch the production domain fresh from the Vercel API so a missing/stale
    // metadata.productionUrl can't mask a down deployment. Fall back to any injected
    // resource metadata only if the API doesn't surface a domain.
    const teamId = conn.config.teamId as string | undefined;
    const projUrl = teamId
      ? `${API}/v9/projects/${externalId}?teamId=${teamId}`
      : `${API}/v9/projects/${externalId}`;

    let prodUrl: string | undefined;
    try {
      const res = await fetchWithTimeout(projUrl, { headers: authHeaders(conn) });
      if (!res.ok) {
        // The projects API call itself failed. 401/403 = token revoked/insufficient (real
        // outage of our access); anything else is treated as a transient degrade, not down,
        // to avoid false positives from rate-limits / 5xx blips.
        if (res.status === 401 || res.status === 403) return { status: 'down', message: 'token sem acesso' };
        return { status: 'degraded', message: `http ${res.status}` };
      }
      const proj = (await res.json()) as VercelProject;
      prodUrl = proj.targets?.production?.alias?.[0] ?? undefined;
    } catch (e) {
      return { status: 'down', message: (e as Error).message };
    }

    // Fallback to metadata productionUrl injected by the collector if the API gave nothing.
    if (!prodUrl) {
      const injected = (resource as unknown as { metadata?: { productionUrl?: unknown } } | undefined)
        ?.metadata?.productionUrl;
      if (typeof injected === 'string' && injected) prodUrl = injected;
    }

    if (!prodUrl) return { status: 'unknown', message: 'sem deploy de produção' };
    return probePublicUrl(`https://${prodUrl}`);
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetchWithTimeout(`${API}/v2/user`, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`vercel validate: invalid token (${res.status})`);
  },
};
