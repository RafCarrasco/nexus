import { fetchWithTimeout } from '@/lib/http';
import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

const API = 'https://api.github.com';

function authHeaders(conn: ConnectionView): Record<string, string> {
  return {
    Authorization: `Bearer ${conn.config.token as string}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

type GHRepo = {
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
  language: string | null;
  pushed_at: string | null;
};

export const GitHubProvider: Provider = {
  type: 'github',

  async listResources(conn): Promise<ResourceDTO[]> {
    const org = conn.config.org as string | undefined;
    const url = org
      ? `${API}/orgs/${org}/repos?per_page=100`
      : `${API}/user/repos?per_page=100`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`github listResources ${res.status}`);
    const repos = (await res.json()) as GHRepo[];
    return repos.map((r) => ({
      externalId: r.full_name,
      name: r.name,
      kind: 'github-repo',
      metadata: {
        defaultBranch: r.default_branch,
        private: r.private,
        url: r.html_url,
        language: r.language,
        pushedAt: r.pushed_at,
      },
    }));
  },

  // GitHub Actions billing requires Billing API + admin scope; out of MVP.
  async getDailyCost(_conn, _id, _date): Promise<CostDTO | null> {
    return null;
  },

  // Read pushedAt from metadata stored at list time — avoids extra API call.
  async getLastActivity(conn, externalId): Promise<Date | null> {
    const url = `${API}/repos/${externalId}`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) return null;
    const repo = (await res.json()) as GHRepo;
    return repo.pushed_at ? new Date(repo.pushed_at) : null;
  },

  // Repo health = "exists"; no real probe needed.
  async getHealth(): Promise<HealthDTO> {
    return { status: 'ok' };
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetchWithTimeout(`${API}/user`, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`github validate: invalid token (${res.status})`);
  },
};
