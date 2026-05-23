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

async function googleAccessToken(conn: ConnectionView): Promise<string> {
  const sa = conn.config.serviceAccount as SAJson;
  const auth = new GoogleAuth({
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-billing.readonly'],
  });
  const r = await auth.getAccessToken();
  if (!r?.token) throw new Error('no access token');
  return r.token;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const FirebaseProvider: Provider = {
  type: 'firebase',

  async listResources(conn): Promise<ResourceDTO[]> {
    appFor(conn); // warm
    const id = projectId(conn);
    return [
      {
        externalId: `project:${id}`,
        name: id,
        kind: 'firebase-project',
        metadata: { projectId: id },
      },
    ];
  },

  async getDailyCost(conn, _externalId, date): Promise<CostDTO | null> {
    const billing = billingAccount(conn);
    if (!billing) return null;
    try {
      const token = await googleAccessToken(conn);
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

  async getHealth(conn, _externalId): Promise<HealthDTO> {
    try {
      const app = appFor(conn);
      await getAuth(app).listUsers(1);
      return { status: 'ok' };
    } catch (e) {
      return { status: 'down', message: (e as Error).message };
    }
  },

  async listTenants(conn, _externalId): Promise<TenantDTO[]> {
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
