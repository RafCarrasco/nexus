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

/** Call the configured provider with the chat history. Returns the reply text; throws on error. */
export async function callLlm(cfg: LoadedAiConfig, messages: ChatMsg[]): Promise<string> {
  if (cfg.provider === 'gemini') return callGemini(cfg, messages);
  if (cfg.provider === 'openai') return callOpenai(cfg, messages);
  return callAnthropic(cfg, messages);
}

async function callAnthropic(cfg: LoadedAiConfig, messages: ChatMsg[]): Promise<string> {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2048, messages }),
    },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { content?: Array<{ type: string; text: string }> };
  return json.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') ?? '';
}

async function callOpenai(cfg: LoadedAiConfig, messages: ChatMsg[]): Promise<string> {
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages }),
    },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? '';
}

async function callGemini(cfg: LoadedAiConfig, messages: ChatMsg[]): Promise<string> {
  // Gemini REST uses roles 'user' | 'model' (not 'assistant') and a parts[] body.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  // The key rides in the query string; never log this URL.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetchWithTimeout(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents }) },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}
