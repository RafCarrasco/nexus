import { prisma } from '@/db/client';
import { decrypt } from '@/crypto/vault';
import { fetchWithTimeout } from '@/lib/http';
import { log } from '@/lib/logger';

export type AiProvider = 'anthropic' | 'openai' | 'gemini';
export const AI_PROVIDERS: readonly AiProvider[] = ['anthropic', 'openai', 'gemini'];
export const AI_CONFIG_ID = 'singleton';

/** Fallback model per provider when the operator leaves the model field blank. */
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export type ChatMsg = { role: 'user' | 'assistant'; content: string };
export type LoadedAiConfig = { provider: AiProvider; model: string; apiKey: string };

export function isAiProvider(v: string): v is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

/** Load the singleton AI config and decrypt the key. Returns null when unset/invalid. */
export async function loadAiConfig(): Promise<LoadedAiConfig | null> {
  const row = await prisma.aiConfig.findUnique({ where: { id: AI_CONFIG_ID } });
  if (!row) return null;
  let apiKey: string;
  try {
    apiKey = decrypt<{ apiKey: string }>(Buffer.from(row.config)).apiKey;
  } catch (e) {
    log.warn('ai config decrypt failed', { err: (e as Error).message });
    return null;
  }
  if (!apiKey) return null;
  const provider = isAiProvider(row.provider) ? row.provider : 'anthropic';
  return { provider, model: row.model || DEFAULT_MODEL[provider], apiKey };
}

const LLM_TIMEOUT_MS = 60_000; // LLM round-trips are slow; well above the default 10s.

/** Call the configured provider with the chat history + optional system prompt. Throws on error. */
export async function callLlm(cfg: LoadedAiConfig, messages: ChatMsg[], system?: string): Promise<string> {
  if (cfg.provider === 'gemini') return callGemini(cfg, messages, system);
  if (cfg.provider === 'openai') return callOpenai(cfg, messages, system);
  return callAnthropic(cfg, messages, system);
}

async function callAnthropic(cfg: LoadedAiConfig, messages: ChatMsg[], system?: string): Promise<string> {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2048, ...(system ? { system } : {}), messages }),
    },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { content?: Array<{ type: string; text: string }> };
  return json.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') ?? '';
}

async function callOpenai(cfg: LoadedAiConfig, messages: ChatMsg[], system?: string): Promise<string> {
  const full = system ? [{ role: 'system' as const, content: system }, ...messages] : messages;
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages: full }),
    },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? '';
}

async function callGemini(cfg: LoadedAiConfig, messages: ChatMsg[], system?: string): Promise<string> {
  // Gemini REST uses roles 'user' | 'model' (not 'assistant') and a parts[] body.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
  // The key rides in the query string; never log this URL.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetchWithTimeout(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

/**
 * Build the Nexus assistant system prompt with a snapshot of live state, so the chat
 * can answer real questions ("quantos incidentes abertos?") instead of being a blank LLM.
 * Best-effort: any query failure degrades gracefully to the static persona.
 */
export async function buildNexusContext(): Promise<string> {
  const persona = [
    'Você é o assistente do Nexus, plataforma interna de observabilidade da Procurement Garage (PG).',
    'Responda em português do Brasil, direto e técnico, sem enrolação.',
    'O Nexus monitora "apps" (workspaces) e suas conexões com provedores (Firebase, Vercel, GitHub, n8n, Docker, etc.),',
    'abre incidentes automáticos quando algo falha, faz checks de uptime e rastreia custo por recurso.',
  ].join(' ');

  try {
    const [workspaces, connections, openIncidents, downChecks, checksTotal] = await Promise.all([
      prisma.workspace.findMany({ select: { name: true }, take: 30 }),
      prisma.connection.findMany({ select: { status: true } }),
      prisma.incident.findMany({
        where: { resolvedAt: null },
        select: { type: true, severity: true, message: true, resource: { select: { name: true } }, uptimeCheck: { select: { name: true } } },
        orderBy: { openedAt: 'desc' },
        take: 8,
      }),
      prisma.uptimeCheck.count({ where: { lastStatus: 'down' } }),
      prisma.uptimeCheck.count(),
    ]);

    const active = connections.filter((c) => c.status === 'active').length;
    const errored = connections.filter((c) => c.status === 'error').length;
    const incidentLines = openIncidents.map((i) => {
      const who = i.resource?.name ?? i.uptimeCheck?.name ?? '—';
      return `  - [${i.severity}] ${who}: ${i.message}`;
    });

    const state = [
      'Estado atual do ambiente (use para responder perguntas sobre o que está acontecendo agora):',
      `- Apps monitorados (${workspaces.length}): ${workspaces.map((w) => w.name).join(', ') || 'nenhum'}`,
      `- Conexões: ${connections.length} (${active} ativas, ${errored} com erro)`,
      `- Incidentes abertos: ${openIncidents.length}`,
      ...(incidentLines.length ? incidentLines : []),
      `- Checks de uptime: ${checksTotal} (${downChecks} fora do ar)`,
    ].join('\n');

    return `${persona}\n\n${state}`;
  } catch (e) {
    log.warn('nexus chat context build failed', { err: (e as Error).message });
    return persona;
  }
}
