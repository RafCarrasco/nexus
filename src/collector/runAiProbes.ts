import { prisma } from '@/db/client';
import { fetchWithTimeout, isSafePublicHttpUrl } from '@/lib/http';
import { extractAnswer, validateRule, judgeWithLlm, evaluateProbeTransition } from '@/lib/ai-probe';
import { log } from '@/lib/logger';
import { listNotifiers } from '@/notify/registry';
import { buildAiProbeContext } from '@/notify/context';

const PROBE_TIMEOUT_MS = 30_000; // AI endpoints are slow; well above the uptime probe's 10s.

/** Outcome of probing + validating one AI endpoint in a tick. */
type ProbeOutcome = {
  /** true = app answered coherently; false = app failed/bad answer; null = judge unavailable, skip this tick. */
  ok: boolean | null;
  /** 'crit' for HTTP/network errors, 'warn' when the app merely gave a bad answer. */
  severity: 'crit' | 'warn';
  answer: string;
  error: string | null;
  judgement: string | null;
};

/**
 * Send the probe's known prompt to the app's AI endpoint and validate the answer.
 *
 * Crucially distinguishes "app gave a bad answer" (ok=false → counts as a failure) from
 * "judge unavailable" (ok=null → skip the tick, do NOT increment consecutiveFails): a
 * Nexus-side AI outage must never false-flag a healthy app as down.
 */
async function probeAi(probe: {
  url: string;
  method: string;
  headers: unknown;
  bodyTemplate: string;
  prompt: string;
  responsePath: string | null;
  validationMode: string;
  validationRule: string | null;
}): Promise<ProbeOutcome> {
  // SSRF guard — refuse to probe internal/loopback/metadata hosts.
  if (!isSafePublicHttpUrl(probe.url)) {
    return { ok: false, severity: 'crit', answer: '', error: 'url insegura', judgement: null };
  }

  // JSON-escape the prompt before substitution so quotes/newlines can't break the body JSON.
  const body = probe.bodyTemplate.replaceAll('$PROMPT', () => jsonEscape(probe.prompt));
  const headers = parseHeaders(probe.headers);

  let res: Response;
  try {
    res = await fetchWithTimeout(probe.url, { method: probe.method || 'POST', headers, body }, PROBE_TIMEOUT_MS);
  } catch (e) {
    return { ok: false, severity: 'crit', answer: '', error: (e as Error).message, judgement: null };
  }

  if (!res.ok) {
    return { ok: false, severity: 'crit', answer: '', error: `http ${res.status}`, judgement: null };
  }

  // Prefer JSON; fall back to raw text so a text/plain endpoint still works.
  let parsed: unknown;
  const raw = await res.text();
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }
  const answer = extractAnswer(parsed, probe.responsePath ?? undefined);

  if (probe.validationMode === 'llm_judge') {
    try {
      const j = await judgeWithLlm(probe.prompt, answer);
      // App answered; judge ruled. Bad answer is a 'warn' severity (app is connected but incoherent).
      return { ok: j.ok, severity: 'warn', answer, error: j.ok ? null : `juiz: ${j.reason}`, judgement: j.reason };
    } catch (e) {
      // Judge itself failed (AI not configured / Nexus AI down). NOT the app's fault → skip tick.
      return { ok: null, severity: 'warn', answer, error: `juiz indisponível: ${(e as Error).message}`, judgement: null };
    }
  }

  const v = validateRule(answer, probe.validationRule);
  return { ok: v.ok, severity: 'warn', answer, error: v.ok ? null : v.reason, judgement: null };
}

/** Escape a string for safe interpolation into JSON, returning the inner (unquoted) form. */
function jsonEscape(s: string): string {
  const json = JSON.stringify(s);
  return json.slice(1, -1);
}

/** Coerce the stored headers Json into a string record; ignore malformed shapes. */
function parseHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  // Default to JSON content-type if the operator didn't set one (templates are JSON).
  if (!Object.keys(out).some((k) => k.toLowerCase() === 'content-type')) out['Content-Type'] = 'application/json';
  return out;
}

/**
 * Probe every enabled AI probe that is due (last check older than its interval), validate
 * the answer, update its state, and open/resolve an incident on the down/up transition —
 * exactly like runUptime. Safe to run frequently: each probe gates itself on intervalSec.
 */
export async function runAiProbes(now: Date = new Date()): Promise<void> {
  const probes = await prisma.aiProbe.findMany({ where: { enabled: true } });

  for (const p of probes) {
    if (p.lastCheckedAt && now.getTime() - p.lastCheckedAt.getTime() < p.intervalSec * 1000) continue;

    try {
      const outcome = await probeAi(p);

      // Judge unavailable: record the error but DON'T advance the state machine — a
      // Nexus-side AI outage shouldn't false-flag the app. Skip to the next probe.
      if (outcome.ok === null) {
        await prisma.aiProbe.update({
          where: { id: p.id },
          data: { lastError: outcome.error, lastCheckedAt: now },
        });
        log.warn('ai probe judge unavailable', { probe: p.name, err: outcome.error });
        continue;
      }

      const t = evaluateProbeTransition(p.consecutiveFails, p.failThreshold, outcome.ok);

      await prisma.aiProbe.update({
        where: { id: p.id },
        data: {
          consecutiveFails: t.consecutiveFails,
          lastStatus: t.status,
          lastError: outcome.ok ? null : outcome.error,
          lastResult: {
            ok: outcome.ok,
            output: outcome.answer.slice(0, 500),
            ...(outcome.judgement ? { judgement: outcome.judgement } : {}),
          },
          lastCheckedAt: now,
        },
      });

      // evaluateProbeTransition only signals 'down' on the transition tick. A probe stuck
      // 'down' won't re-open after an operator manually resolves while it's still failing —
      // the incident stays masked. Guard: if it failed and we're already down but no
      // transition fired, ensure an open incident exists (idempotent findFirst).
      let shouldOpen = t.transition === 'down';
      if (!shouldOpen && !outcome.ok && t.status === 'down') {
        const existing = await prisma.incident.findFirst({
          where: { aiProbeId: p.id, type: 'ai_probe_failed', resolvedAt: null },
        });
        if (!existing) shouldOpen = true;
      }

      if (shouldOpen) {
        const inc = await prisma.incident.create({
          data: {
            aiProbeId: p.id,
            type: 'ai_probe_failed',
            severity: outcome.severity,
            message: `${p.name} respondeu mal: ${outcome.error ?? 'resposta inválida'}`,
          },
        });
        log.warn('ai probe down', { probe: p.name, url: p.url, fails: t.consecutiveFails, severity: outcome.severity });
        try {
          const ctx = buildAiProbeContext(p, 'open');
          for (const n of listNotifiers()) await n.notify(inc, ctx);
        } catch (e) {
          log.warn('ai probe open notify failed', { probe: p.name, err: (e as Error).message });
        }
      }

      if (t.transition === 'up') {
        // Select-then-update so we can fire resolve notifications for the exact rows.
        const open = await prisma.incident.findMany({
          where: { aiProbeId: p.id, type: 'ai_probe_failed', resolvedAt: null },
          select: { id: true },
        });
        const ids = open.map((i) => i.id);
        if (ids.length > 0) {
          await prisma.incident.updateMany({
            where: { id: { in: ids }, resolvedAt: null },
            data: { resolvedAt: now },
          });
        }
        log.info('ai probe recovered', { probe: p.name, url: p.url });
        try {
          const ctx = buildAiProbeContext(p, 'resolve');
          // Re-fetch in one query AFTER the update so resolvedAt is stamped (notify-format reads it).
          const resolved = ids.length > 0 ? await prisma.incident.findMany({ where: { id: { in: ids } } }) : [];
          for (const inc of resolved) {
            for (const n of listNotifiers()) await n.notify(inc, ctx);
          }
        } catch (e) {
          log.warn('ai probe resolve notify failed', { probe: p.name, err: (e as Error).message });
        }
      }
    } catch (e) {
      log.warn('ai probe check failed', { probe: p.name, err: (e as Error).message });
    }
  }
}
