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

function billingAccount(conn: ConnectionView): string | undefined {
  return conn.config.billingAccountId as string | undefined;
}


async function googleAccessToken(
  conn: ConnectionView,
  scopes: string[] = ['https://www.googleapis.com/auth/cloud-platform.read-only'],
): Promise<string> {
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

type CloudFunction = {
  name: string;
  state?: string;
  buildConfig?: { runtime?: string; entryPoint?: string };
  serviceConfig?: { uri?: string };
};

async function listCloudFunctions(conn: ConnectionView): Promise<CloudFunction[]> {
  try {
    const token = await googleAccessToken(conn, ['https://www.googleapis.com/auth/cloud-platform.read-only']);
    const pid = projectId(conn);
    const res = await fetch(
      `https://cloudfunctions.googleapis.com/v2/projects/${pid}/locations/-/functions`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { functions?: CloudFunction[] };
    return json.functions ?? [];
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

    const functions = await listCloudFunctions(conn);
    const functionResources: ResourceDTO[] = functions.map((fn) => ({
      externalId: `function:${fn.name}`,
      name: fn.name.split('/').pop()!,
      kind: 'firebase-function',
      metadata: {
        state: fn.state,
        runtime: fn.buildConfig?.runtime,
        entryPoint: fn.buildConfig?.entryPoint,
        url: fn.serviceConfig?.uri,
        projectId: id,
      },
    }));

    return [projectResource, ...hostingResources, ...functionResources];
  },

  async getDailyCost(conn, externalId, date): Promise<CostDTO | null> {
    // Cost only makes sense for the project resource
    if (externalId && !externalId.startsWith('project:')) return null;

    // Prefer BigQuery if configured
    const bqDataset = conn.config.bigQueryDataset as string | undefined;
    const bqProject = (conn.config.bigQueryProject as string | undefined) ?? projectId(conn);
    const billing = billingAccount(conn);

    if (bqDataset && billing) {
      return getDailyCostViaBigQuery({
        conn,
        projectId: projectId(conn),
        bqProject,
        bqDataset,
        billingAccountId: billing,
        date,
      });
    }

    // Fallback: Cloud Monitoring
    return getDailyCostViaMonitoring({ conn, projectId: projectId(conn), date });
  },

  async getLastActivity(_conn, _externalId): Promise<Date | null> {
    // MVP: derive later from Cloud Logging. For now, return null so the UI shows "—".
    return null;
  },

  async getHealth(conn, externalId): Promise<HealthDTO> {
    // Function resources: return unknown (state is captured at collection time in metadata)
    if (externalId.startsWith('function:')) {
      return { status: 'unknown', message: 'state captured at collection time' };
    }

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

// ── Cost helpers ──────────────────────────────────────────────────────────────

async function getDailyCostViaMonitoring(args: {
  conn: ConnectionView;
  projectId: string;
  date: Date;
}): Promise<CostDTO | null> {
  const { conn, projectId, date } = args;
  try {
    const token = await googleAccessToken(conn, ['https://www.googleapis.com/auth/monitoring.read']);
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    const params = new URLSearchParams({
      filter: `metric.type="billing.googleapis.com/billing/total_cost" AND resource.labels.project_id="${projectId}"`,
      'interval.startTime': start.toISOString(),
      'interval.endTime': end.toISOString(),
      'aggregation.alignmentPeriod': '86400s',
      'aggregation.perSeriesAligner': 'ALIGN_SUM',
    });
    const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      timeSeries?: Array<{
        points?: Array<{ value?: { doubleValue?: number } }>;
        metric?: { labels?: { currency?: string } };
      }>;
    };
    if (!json.timeSeries?.length) return null;
    let total = 0;
    let currency = 'USD';
    for (const ts of json.timeSeries) {
      currency = ts.metric?.labels?.currency ?? currency;
      for (const p of ts.points ?? []) total += p.value?.doubleValue ?? 0;
    }
    if (total === 0) return null;
    return { amount: total, currency, source: 'cloud-monitoring' };
  } catch {
    return null;
  }
}

async function getDailyCostViaBigQuery(args: {
  conn: ConnectionView;
  projectId: string;
  bqProject: string;
  bqDataset: string;
  billingAccountId: string;
  date: Date;
}): Promise<(CostDTO & { breakdown?: Array<{ service: string; amount: number }> }) | null> {
  const { conn, projectId, bqProject, bqDataset, billingAccountId, date } = args;
  try {
    const token = await googleAccessToken(conn, ['https://www.googleapis.com/auth/bigquery.readonly']);
    const tableName = `gcp_billing_export_v1_${billingAccountId.replace(/-/g, '_')}`;
    const dayIso = date.toISOString().slice(0, 10);

    const sql = `
      SELECT
        service.description AS service,
        SUM(cost) AS cost,
        ANY_VALUE(currency) AS currency
      FROM \`${bqProject}.${bqDataset}.${tableName}\`
      WHERE DATE(usage_start_time) = DATE("${dayIso}")
        AND project.id = "${projectId}"
      GROUP BY service
      ORDER BY cost DESC
    `;

    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProject}/queries`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        timeoutMs: 30000,
        location: 'US',
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rows?: Array<{ f: Array<{ v: string }> }>;
      schema?: { fields: Array<{ name: string }> };
    };
    if (!json.rows?.length) return null;

    // Row format: [{v: service}, {v: cost}, {v: currency}]
    const breakdown: Array<{ service: string; amount: number }> = [];
    let total = 0;
    let currency = 'USD';
    for (const r of json.rows) {
      const service = r.f[0]?.v ?? 'unknown';
      const amount = Number(r.f[1]?.v ?? 0);
      currency = r.f[2]?.v ?? currency;
      breakdown.push({ service, amount });
      total += amount;
    }
    if (total === 0) return null;
    return { amount: total, currency, source: 'bigquery', breakdown };
  } catch {
    return null;
  }
}

// dispose helper for tests
export async function disposeFirebaseApp(conn: ConnectionView): Promise<void> {
  const name = `nexus-${conn.id}`;
  const app = getApps().find((a) => a.name === name);
  if (app) await deleteApp(app);
}
