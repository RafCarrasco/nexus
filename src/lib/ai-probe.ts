import { loadAiConfig, callLlm } from '@/lib/ai';

/**
 * Pure helpers for AI quality probes. A probe sends a KNOWN prompt to an app's AI
 * endpoint and validates the answer — answering "is this AI app actually working,
 * giving coherent answers, not just connected?". Two validation modes:
 *   - 'rule': cheap, deterministic substring/non-empty checks.
 *   - 'llm_judge': reuses Nexus's own configured AI to judge coherence.
 *
 * The state machine (evaluateProbeTransition) mirrors evaluateUptime exactly so the
 * incident lifecycle stays identical: debounce N consecutive failures before flipping
 * 'down', resolve on recovery.
 */

export type ProbeStatus = 'up' | 'down';

export type ProbeTransition = {
  status: ProbeStatus;
  consecutiveFails: number;
  transition: 'none' | 'down' | 'up';
};

/**
 * Walk a dot-path into a JSON body to pull out the answer string, supporting numeric
 * array indices (e.g. "choices.0.message.content"). An empty/undefined path stringifies
 * the whole body. A path that misses returns '' (treated as an empty answer downstream).
 */
export function extractAnswer(body: unknown, responsePath?: string): string {
  const path = (responsePath ?? '').trim();
  if (!path) return stringify(body);

  let cur: unknown = body;
  for (const seg of path.split('.')) {
    if (cur == null) return '';
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx)) return '';
      cur = cur[idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return '';
    }
  }
  return stringify(cur);
}

/** Coerce an extracted value to text: strings pass through, everything else is JSON. */
function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

/**
 * Rule-based validation. Supported rules:
 *   - 'non_empty'        → ok if the trimmed answer has any content.
 *   - 'contains:<substr>'→ ok if the answer includes <substr> (case-insensitive).
 * Anything else (including null) defaults to non_empty.
 */
export function validateRule(answer: string, rule: string | null): { ok: boolean; reason: string } {
  const r = (rule ?? '').trim();
  if (r.toLowerCase().startsWith('contains:')) {
    const needle = r.slice('contains:'.length);
    const ok = answer.toLowerCase().includes(needle.toLowerCase());
    return { ok, reason: ok ? `resposta contém "${needle}"` : `resposta não contém "${needle}"` };
  }
  // default: non_empty
  const ok = answer.trim().length > 0;
  return { ok, reason: ok ? 'resposta não vazia' : 'resposta vazia' };
}

/**
 * Pure state machine for a single probe tick. Mirrors evaluateUptime's debounce: the
 * probe only flips to 'down' (transition 'down') after `failThreshold` consecutive bad
 * answers; a good answer while previously down recovers (transition 'up').
 *
 * Shape differs from evaluateUptime by design (returns the prior status to detect the
 * masked-reopen case in the collector), but the debounce arithmetic is identical.
 */
export function evaluateProbeTransition(consecutiveFails: number, failThreshold: number, ok: boolean): ProbeTransition {
  if (ok) {
    return {
      status: 'up',
      consecutiveFails: 0,
      transition: consecutiveFails > 0 ? 'up' : 'none',
    };
  }
  const fails = consecutiveFails + 1;
  const down = fails >= Math.max(1, failThreshold);
  return {
    status: down ? 'down' : 'up',
    consecutiveFails: fails,
    // 'down' fires only on the tick that crosses the threshold (transition), not while stuck down.
    transition: down && consecutiveFails + 1 === Math.max(1, failThreshold) ? 'down' : 'none',
  };
}

/**
 * Judge an answer's coherence using Nexus's OWN configured AI. Throws 'IA não configurada'
 * when no AI is set up — the caller MUST treat that (and any callLlm error) as "judge
 * unavailable", NOT as the probed app failing, so a Nexus-side AI outage never false-flags
 * a healthy app.
 */
export async function judgeWithLlm(prompt: string, answer: string): Promise<{ ok: boolean; reason: string }> {
  const cfg = await loadAiConfig();
  if (!cfg) throw new Error('IA não configurada');
  const reply = await callLlm(cfg, [
    {
      role: 'user',
      content: `Pergunta enviada ao app:\n${prompt}\n\nResposta do app:\n${answer}\n\nA resposta é coerente e responde à pergunta? Comece com SIM ou NAO e dê um motivo curto.`,
    },
  ]);
  const ok = /^\s*sim/i.test(reply);
  return { ok, reason: reply.slice(0, 300) };
}
