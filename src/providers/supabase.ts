import { fetchWithTimeout } from '@/lib/http';
import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

const API = 'https://api.supabase.com';

function authHeaders(conn: ConnectionView): Record<string, string> {
  return { Authorization: `Bearer ${conn.config.token}`, 'Content-Type': 'application/json' };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Supabase Personal Access Tokens are account-wide — they can't be scoped to one
 * project. To track only specific projects, the operator may set `projectRefs`
 * (array, or a comma/space-separated string of project refs); listResources then
 * returns only those. Empty/unset = all projects the token can see.
 */
function parseProjectRefs(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export const SupabaseProvider: Provider = {
  type: 'supabase',

  async listResources(conn): Promise<ResourceDTO[]> {
    const res = await fetchWithTimeout(`${API}/v1/projects`, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`supabase listResources ${res.status}`);
    let projects = (await res.json()) as Array<{ id: string; name: string; region?: string }>;
    const refs = parseProjectRefs(conn.config.projectRefs);
    if (refs.length) projects = projects.filter((p) => refs.includes(p.id));
    return projects.map((p) => ({
      externalId: p.id,
      name: p.name,
      kind: 'supabase-project',
      region: p.region,
      metadata: { ref: p.id },
    }));
  },

  async getDailyCost(conn, _externalId, date): Promise<CostDTO | null> {
    const org = conn.config.orgSlug as string | undefined;
    if (!org) return null;
    const day = ymd(date);
    const url = `${API}/v1/organizations/${org}/billing/usage?from=${day}&to=${day}`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) return null;
    const j = (await res.json()) as { usage?: Array<{ date: string; total_amount: number; currency: string }> };
    const row = j.usage?.find((u) => u.date === day) ?? j.usage?.[0];
    if (!row) return null;
    return { amount: row.total_amount, currency: row.currency, source: 'supabase-billing' };
  },

  async getLastActivity(conn, externalId): Promise<Date | null> {
    const url = `${API}/v1/projects/${externalId}/database/usage`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(conn) });
    if (!res.ok) return null;
    const j = (await res.json()) as { last_query_at?: string };
    return j.last_query_at ? new Date(j.last_query_at) : null;
  },

  async getHealth(conn, externalId): Promise<HealthDTO> {
    // The Management API requires a `services` query param, serialized as REPEATED
    // params (services=db&services=auth&…) — comma-separated returns 400. We poll the
    // core always-present services and read each one's `healthy` flag. On any non-2xx
    // we surface the response body in the message so the real cause is visible
    // (e.g. a paused project) instead of a bare "http 400".
    const params = new URLSearchParams();
    for (const s of ['db', 'auth', 'rest', 'storage', 'realtime']) params.append('services', s);
    const res = await fetchWithTimeout(`${API}/v1/projects/${externalId}/health?${params.toString()}`, {
      headers: authHeaders(conn),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 200);
      return { status: 'down', message: `http ${res.status}${detail ? ` — ${detail}` : ''}` };
    }
    const body = (await res.json()) as Array<{ name?: string; healthy?: boolean; status?: string }>;
    if (!Array.isArray(body)) return { status: 'ok' };
    const bad = body.filter((s) => s.healthy === false);
    if (bad.length === 0) return { status: 'ok' };
    // Database down = hard down (crit); any other service degraded = warn.
    const dbDown = bad.some((s) => s.name === 'db');
    const names = bad.map((s) => `${s.name ?? '?'}=${s.status ?? 'unhealthy'}`).join(', ');
    return { status: dbDown ? 'down' : 'degraded', message: `serviços com problema: ${names}` };
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn) {
    const res = await fetchWithTimeout(`${API}/v1/projects`, { headers: authHeaders(conn) });
    if (!res.ok) throw new Error(`supabase validate ${res.status}`);
  },
};
