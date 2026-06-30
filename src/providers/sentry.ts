import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';
import { fetchWithTimeout, isSafePublicHttpUrl } from '@/lib/http';

/**
 * Sentry provider. Primarily a webhook SINK: errors flow in via POST /api/ingest/sentry
 * and the webhook creates project resources + `sentry_issue` incidents on demand. When an
 * org auth token is configured it ALSO pulls the project list (so projects appear even
 * before their first error). No cost/activity — Sentry is an error signal, not a billed
 * resource here.
 */

function baseUrl(conn: ConnectionView): string {
  const b = (conn.config.baseUrl as string | undefined)?.trim() || 'https://sentry.io';
  return b.replace(/\/+$/, '');
}
function authToken(conn: ConnectionView): string | null {
  const t = (conn.config.authToken as string | undefined)?.trim();
  return t || null;
}
function org(conn: ConnectionView): string | null {
  const o = (conn.config.org as string | undefined)?.trim();
  return o || null;
}

async function fetchProjects(conn: ConnectionView): Promise<ResourceDTO[]> {
  const token = authToken(conn);
  const o = org(conn);
  if (!token || !o) return []; // ingest-only mode — the webhook materializes resources.
  const url = `${baseUrl(conn)}/api/0/organizations/${encodeURIComponent(o)}/projects/`;
  if (!isSafePublicHttpUrl(url)) throw new Error('unsafe Sentry base url');
  const res = await fetchWithTimeout(
    url,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    15000,
  );
  if (!res.ok) throw new Error(`Sentry API http ${res.status}`);
  const json = (await res.json()) as Array<{ slug?: string; name?: string; platform?: string }>;
  if (!Array.isArray(json)) return [];
  return json
    .filter((p) => p.slug)
    .map((p) => ({
      externalId: p.slug as string,
      name: p.name || (p.slug as string),
      kind: 'sentry-project',
      metadata: { platform: p.platform ?? null, org: o },
    }));
}

export const SentryProvider: Provider = {
  type: 'sentry',
  async listResources(conn): Promise<ResourceDTO[]> {
    return fetchProjects(conn);
  },
  async getDailyCost(): Promise<CostDTO | null> {
    return null;
  },
  async getLastActivity(): Promise<Date | null> {
    return null;
  },
  async getHealth(): Promise<HealthDTO> {
    // Project-level health comes from incidents raised by the webhook, not a probe here.
    return { status: 'ok' };
  },
  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },
  async validate(conn): Promise<void> {
    const token = authToken(conn);
    const o = org(conn);
    // Webhook-only connection: no token needed, accept a minimal/empty config.
    if (!token && !o) return;
    if (!token || !o) {
      throw new Error('para puxar projetos informe authToken E org (ou deixe ambos vazios para usar só o webhook)');
    }
    const url = `${baseUrl(conn)}/api/0/organizations/${encodeURIComponent(o)}/projects/`;
    if (!isSafePublicHttpUrl(url)) throw new Error('unsafe Sentry base url');
    const res = await fetchWithTimeout(
      url,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      15000,
    );
    if (!res.ok) throw new Error(`Sentry rejeitou o token (http ${res.status})`);
  },
};
