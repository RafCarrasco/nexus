import { fetchWithTimeout } from '@/lib/http';
import { estimateTokenCostUsd } from '@/lib/llm-pricing';
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
  stoppedAt?: string;
};

export type N8nExecStats = {
  window: number; // executions inspected
  success: number;
  error: number;
  running: number;
  errorRate: number; // 0..1 over finished (success+error)
  avgDurationMs: number | null;
  lastErrorAt: string | null;
  lastRunAt: string | null;
};

/** Aggregate recent execution outcomes for a workflow — agent run health over time. */
async function getExecutionStats(
  conn: ConnectionView,
  workflowId: string,
  limit = 50,
): Promise<N8nExecStats | null> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl(conn)}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
      { headers: headers(conn) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: N8nExecution[] } | N8nExecution[];
    const execs: N8nExecution[] = Array.isArray(body) ? body : (body.data ?? []);

    let success = 0;
    let error = 0;
    let running = 0;
    let durSum = 0;
    let durCount = 0;
    let lastErrorAt: string | null = null;
    let lastRunAt: string | null = null;

    // n8n returns most-recent first, so the first match wins for "last*".
    for (const e of execs) {
      if (e.startedAt && !lastRunAt) lastRunAt = e.startedAt;
      if (e.status === 'success') success++;
      else if (e.status === 'error' || e.status === 'crashed') {
        error++;
        if (!lastErrorAt && e.startedAt) lastErrorAt = e.startedAt;
      } else if (e.status === 'running' || e.status === 'waiting') running++;
      if (e.startedAt && e.stoppedAt) {
        durSum += new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime();
        durCount++;
      }
    }
    const finished = success + error;
    return {
      window: execs.length,
      success,
      error,
      running,
      errorRate: finished ? error / finished : 0,
      avgDurationMs: durCount ? Math.round(durSum / durCount) : null,
      lastErrorAt,
      lastRunAt,
    };
  } catch {
    return null;
  }
}

/**
 * Recursively sum AI token-usage numbers in an n8n execution payload (best-effort).
 * Matches `tokens` / `totalTokens` / `total_tokens` numeric fields (LangChain/AI Agent
 * nodes expose these under varying paths). Prompt/completion sub-counts are ignored to
 * avoid double-counting. Returns an estimate — exact shape is n8n-version-dependent.
 */
export function sumTokenUsage(node: unknown, depth = 0): number {
  if (depth > 20 || node == null || typeof node !== 'object') return 0;
  let total = 0;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === 'number' && /^(tokens|total_?tokens)$/i.test(k)) total += v;
    else if (typeof v === 'object') total += sumTokenUsage(v, depth + 1);
  }
  return total;
}

/**
 * Recursively find an LLM model name in an execution payload (best-effort). Matches
 * string values under model-ish keys that look like a known model family.
 */
export function findModelName(node: unknown, depth = 0): string | undefined {
  if (depth > 20 || node == null || typeof node !== 'object') return undefined;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === 'string' && /^model(name|_?id)?$/i.test(k) && /(gpt|claude|gemini|llama|mistral|o1|o3)/i.test(v)) {
      return v;
    }
    if (typeof v === 'object') {
      const found = findModelName(v, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

/** Token usage + model of the latest successful run (best-effort; fetches full exec data). */
async function getRecentTokenInfo(
  conn: ConnectionView,
  workflowId: string,
): Promise<{ tokens: number; model?: string } | undefined> {
  try {
    const listRes = await fetchWithTimeout(
      `${baseUrl(conn)}/api/v1/executions?workflowId=${workflowId}&limit=1&status=success`,
      { headers: headers(conn) },
    );
    if (!listRes.ok) return undefined;
    const body = (await listRes.json()) as { data?: N8nExecution[] } | N8nExecution[];
    const execs: N8nExecution[] = Array.isArray(body) ? body : (body.data ?? []);
    const id = execs[0]?.id;
    if (!id) return undefined;

    const res = await fetchWithTimeout(
      `${baseUrl(conn)}/api/v1/executions/${id}?includeData=true`,
      { headers: headers(conn) },
    );
    if (!res.ok) return undefined;
    const full = await res.json();
    const tokens = sumTokenUsage(full);
    if (tokens <= 0) return undefined;
    return { tokens, model: findModelName(full) };
  } catch {
    return undefined;
  }
}

export const N8nProvider: Provider = {
  type: 'n8n',

  async listResources(conn): Promise<ResourceDTO[]> {
    const res = await fetchWithTimeout(`${baseUrl(conn)}/api/v1/workflows?limit=250`, { headers: headers(conn) });
    if (!res.ok) throw new Error(`n8n listResources ${res.status}`);
    const body = (await res.json()) as { data?: N8nWorkflow[] } | N8nWorkflow[];
    const workflows: N8nWorkflow[] = Array.isArray(body) ? body : (body.data ?? []);

    // Enrich active workflows with agent-run stats + token usage (best-effort, concurrent).
    // Inactive workflows don't run, so skip the extra calls.
    return Promise.all(
      workflows.map(async (w) => {
        const [execStats, tokenInfo] = w.active
          ? await Promise.all([getExecutionStats(conn, w.id), getRecentTokenInfo(conn, w.id)])
          : [null, undefined];
        return {
          externalId: `workflow:${w.id}`,
          name: w.name,
          kind: 'n8n-workflow',
          metadata: {
            active: w.active,
            tags: w.tags?.map((t) => t.name) ?? [],
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            nodeCount: (w.nodes ?? []).length,
            execStats: execStats ?? undefined,
            recentTokens: tokenInfo?.tokens,
            recentModel: tokenInfo?.model,
            recentTokenCostUsd: tokenInfo ? estimateTokenCostUsd(tokenInfo.tokens, tokenInfo.model) : undefined,
          },
        };
      }),
    );
  },

  // Token usage is surfaced in metadata; mapping tokens→money needs a per-model price
  // table (tracked in QUEUE.md / Frente C-D), so cost stays null for now.
  async getDailyCost(_conn, _externalId, _date): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(conn, externalId): Promise<Date | null> {
    const wfId = externalId.replace(/^workflow:/, '');
    const res = await fetchWithTimeout(
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
    const wfRes = await fetchWithTimeout(`${baseUrl(conn)}/api/v1/workflows/${wfId}`, { headers: headers(conn) });
    if (!wfRes.ok) return { status: 'down', message: `http ${wfRes.status}` };
    const wf = (await wfRes.json()) as N8nWorkflow;

    if (!wf.active) {
      return { status: 'unknown', message: 'inativo' };
    }

    // Health from the recent error rate — drives the collector's auto-incident on
    // agent-run failure spikes (a workflow that starts erroring opens an incident).
    const stats = await getExecutionStats(conn, wfId, 20);
    if (!stats || stats.window === 0) return { status: 'ok' };
    if (stats.errorRate === 0) return { status: 'ok' };
    const pct = Math.round(stats.errorRate * 100);
    const detail = `erro ${pct}% (${stats.error}/${stats.success + stats.error})`;
    if (stats.errorRate < 0.5) return { status: 'degraded', message: detail };
    return { status: 'down', message: detail };
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn): Promise<void> {
    const res = await fetchWithTimeout(`${baseUrl(conn)}/api/v1/workflows?limit=1`, { headers: headers(conn) });
    if (!res.ok) throw new Error(`n8n validate ${res.status}`);
  },
};
