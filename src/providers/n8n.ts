import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

function headers(conn: ConnectionView): Record<string, string> {
  return {
    'X-N8N-API-KEY': String(conn.config.apiKey ?? ''),
    'accept': 'application/json',
  };
}

function baseUrl(conn: ConnectionView): string {
  const url = String(conn.config.baseUrl ?? '').replace(/\/+$/, '');
  if (!url) throw new Error('baseUrl missing');
  return url;
}

type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  tags?: Array<{ name: string }>;
  createdAt: string;
  updatedAt: string;
  nodes?: unknown[];
};

type N8nExecution = {
  id: string;
  status: string;
  startedAt?: string;
};

export const N8nProvider: Provider = {
  type: 'n8n',

  async listResources(conn): Promise<ResourceDTO[]> {
    const res = await fetch(`${baseUrl(conn)}/api/v1/workflows?limit=250`, { headers: headers(conn) });
    if (!res.ok) throw new Error(`n8n listResources ${res.status}`);
    const body = (await res.json()) as { data?: N8nWorkflow[] } | N8nWorkflow[];
    const workflows: N8nWorkflow[] = Array.isArray(body) ? body : (body.data ?? []);
    return workflows.map((w) => ({
      externalId: `workflow:${w.id}`,
      name: w.name,
      kind: 'n8n-workflow',
      metadata: {
        active: w.active,
        tags: w.tags?.map((t) => t.name) ?? [],
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodeCount: (w.nodes ?? []).length,
      },
    }));
  },

  async getDailyCost(_conn, _externalId, _date): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(conn, externalId): Promise<Date | null> {
    const wfId = externalId.replace(/^workflow:/, '');
    const res = await fetch(
      `${baseUrl(conn)}/api/v1/executions?workflowId=${wfId}&limit=1`,
      { headers: headers(conn) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: N8nExecution[] } | N8nExecution[];
    const executions: N8nExecution[] = Array.isArray(body) ? body : (body.data ?? []);
    const first = executions[0];
    if (!first?.startedAt) return null;
    return new Date(first.startedAt);
  },

  async getHealth(conn, externalId): Promise<HealthDTO> {
    // Determine active from a fresh workflow fetch
    const wfId = externalId.replace(/^workflow:/, '');
    const wfRes = await fetch(`${baseUrl(conn)}/api/v1/workflows/${wfId}`, { headers: headers(conn) });
    if (!wfRes.ok) return { status: 'down', message: `http ${wfRes.status}` };
    const wf = (await wfRes.json()) as N8nWorkflow;

    if (!wf.active) {
      return { status: 'unknown', message: 'inativo' };
    }

    const execRes = await fetch(
      `${baseUrl(conn)}/api/v1/executions?workflowId=${wfId}&limit=5`,
      { headers: headers(conn) },
    );
    if (!execRes.ok) return { status: 'unknown', message: `executions ${execRes.status}` };
    const body = (await execRes.json()) as { data?: N8nExecution[] } | N8nExecution[];
    const executions: N8nExecution[] = Array.isArray(body) ? body : (body.data ?? []);

    const errorCount = executions.filter((e) => e.status === 'error').length;
    if (errorCount === 0) return { status: 'ok' };
    if (errorCount <= 2) return { status: 'degraded', message: `${errorCount} erros nos últimos 5` };
    return { status: 'down', message: `${errorCount} erros nos últimos 5` };
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetch(`${baseUrl(conn)}/api/v1/workflows?limit=1`, { headers: headers(conn) });
    if (!res.ok) throw new Error(`n8n validate ${res.status}`);
  },
};
