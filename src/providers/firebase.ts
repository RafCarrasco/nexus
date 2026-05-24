import { initializeApp, cert, getApps, deleteApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleAuth } from 'google-auth-library';
import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

type SAJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function appFor(conn: ConnectionView): App {
  const sa = conn.config.serviceAccount as SAJson;
  const name = `nexus-${conn.id}`;
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp({ credential: cert(sa as never) }, name);
}

function projectId(conn: ConnectionView): string {
  return (conn.config.serviceAccount as SAJson).project_id;
}

function billingAccount(conn: ConnectionView): string | null {
  return (conn.config.billingAccountId as string | undefined) ?? null;
}

async function googleAccessToken(conn: ConnectionView, scopes: string[]): Promise<string> {
  const sa = conn.config.serviceAccount as SAJson;
  const auth = new GoogleAuth({
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
    scopes,
  });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('no access token');
  return token;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type HostingSite = {
  name: string;
  defaultUrl?: string;
  appId?: string;
};

async function listHostingSites(conn: ConnectionView): Promise<HostingSite[]> {
  try {
    const token = await googleAccessToken(conn, ['https://www.googleapis.com/auth/firebase']);
    const pid = projectId(conn);
    const res = await fetch(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${pid}/sites`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { sites?: HostingSite[] };
    return json.sites ?? [];
  } catch {
    return [];
  }
}

export const FirebaseProvider: Provider = {
  type: 'firebase',

  async listResources(conn): Promise<ResourceDTO[]> {
    appFor(conn); // warm
    const id = projectId(conn);

    const projectResource: ResourceDTO = {
      externalId: `project:${id}`,
      name: id,
      kind: 'firebase-project',
      metadata: { projectId: id },
    };

    const sites = await listHostingSites(conn);
    const hostingResources: ResourceDTO[] = sites.map((site) => ({
      externalId: `hosting:${site.name}`,
      name: site.name.split('/').pop() ?? site.name,
      kind: 'firebase-hosting',
      metadata: {
        defaultUrl: site.defaultUrl,
        appId: site.appId,
        projectId: id,
      },
    }));

    return [projectResource, ...hostingResources];
  },

  async getDailyCost(conn, _externalId, date): Promise<CostDTO | null> {
    const billing = billingAccount(conn);
    if (!billing) return null;
    try {
      const token = await googleAccessToken(conn, ['https://www.googleapis.com/auth/cloud-billing.readonly']);
      const day = formatDate(date);
      const url =
        `https://cloudbilling.googleapis.com/v1/billingAccounts/${billing}` +
        `:queryCost?startDate=${day}&endDate=${day}&filter=project:${projectId(conn)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const json = (await res.json()) as { amount?: { units?: string; nanos?: number; currencyCode?: string } };
      const a = json.amount;
      if (!a) return null;
      const units = Number(a.units ?? 0);
      const nanos = (a.nanos ?? 0) / 1e9;
      return { amount: units + nanos, currency: a.currencyCode ?? 'USD', source: 'cloud-billing' };
    } catch {
      return null;
    }
  },

  async getLastActivity(_conn, _externalId): Promise<Date | null> {
    // MVP: derive later from Cloud Logging. For now, return null so the UI shows "—".
    return null;
  },

  async getHealth(conn, externalId): Promise<HealthDTO> {
    // Hosting resources: probe the defaultUrl
    if (externalId.startsWith('hosting:')) {
      try {
        // externalId = hosting:projects/<pid>/sites/<siteId>
        // We need to find the defaultUrl — fetch sites again (cached by underlying SDK in practice)
        const sites = await listHostingSites(conn);
        const siteName = externalId.slice('hosting:'.length);
        const site = sites.find((s) => s.name === siteName);
        const url = site?.defaultUrl;
        if (!url) return { status: 'unknown', message: 'no defaultUrl' };
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return { status: 'ok' };
        return { status: 'degraded', message: `HTTP ${res.status}` };
      } catch (e) {
        return { status: 'down', message: (e as Error).message };
      }
    }

    // Project resource: probe Auth
    try {
      const app = appFor(conn);
      await getAuth(app).listUsers(1);
      return { status: 'ok' };
    } catch (e) {
      return { status: 'down', message: (e as Error).message };
    }
  },

  async listTenants(conn, externalId): Promise<TenantDTO[]> {
    // Tenants belong to the Auth project — only emit for project resources
    if (!externalId.startsWith('project:')) return [];
    const app = appFor(conn);
    try {
      const r = await getAuth(app).tenantManager().listTenants(1000);
      return r.tenants.map((t) => ({ externalId: t.tenantId, displayName: t.displayName ?? t.tenantId }));
    } catch {
      return [];
    }
  },

  async validate(conn) {
    const app = appFor(conn);
    await getAuth(app).listUsers(1);
  },
};

// dispose helper for tests
export async function disposeFirebaseApp(conn: ConnectionView): Promise<void> {
  const name = `nexus-${conn.id}`;
  const app = getApps().find((a) => a.name === name);
  if (app) await deleteApp(app);
}
