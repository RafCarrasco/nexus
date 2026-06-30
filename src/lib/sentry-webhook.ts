/**
 * Pure parser for a Sentry webhook payload (Internal Integration "issue" hook, or a
 * legacy event/alert hook). Extracts the fields Nexus needs to open a `sentry_issue`
 * incident, defensively — Sentry's shape varies by hook type and version, so every field
 * is optional with fallbacks. No IO; unit-tested. The route does the DB work around it.
 */
export type SentryWebhookParsed = {
  issueId: string | null;
  projectSlug: string | null;
  projectName: string | null;
  title: string;
  culprit: string | null;
  level: string | null;
  severity: 'crit' | 'warn';
  count: number | null;
  permalink: string | null;
  action: string | null;
  isResolved: boolean;
};

/** Trimmed string clamped to `max` chars (default 256). Attacker-controlled — always cap. */
function str(v: unknown, max = 256): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

/** Finite, non-negative integer clamped to 2e9 — fits Postgres int4 and Decimal(18,6) so a
 *  huge `count` can't overflow the column and throw (which would 5xx → Sentry retry storm). */
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? Math.trunc(v) : typeof v === 'string' && v.trim() ? Math.trunc(Number(v)) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 2_000_000_000) return null;
  return n;
}

function levelToSeverity(level: string | null): 'crit' | 'warn' {
  const l = (level ?? '').toLowerCase();
  if (l === 'fatal' || l === 'error' || l === 'critical') return 'crit';
  return 'warn';
}

export function mapSentryWebhook(body: unknown): SentryWebhookParsed | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const action = str(b.action, 32);
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
  const issue = (data.issue && typeof data.issue === 'object' ? data.issue : null) as Record<string, unknown> | null;
  const event = (data.event && typeof data.event === 'object' ? data.event : null) as Record<string, unknown> | null;
  const src = issue ?? event;
  if (!src) return null;

  const project = (src.project && typeof src.project === 'object' ? src.project : null) as Record<string, unknown> | null;
  // issue.project is an object {slug,name}; event.project is the slug string.
  const projectSlug = str(project?.slug, 128) ?? str(src.project, 128);
  const projectName = str(project?.name, 256) ?? projectSlug;
  const issueId = str(src.id, 64) ?? str(src.issue_id, 64) ?? str(src.groupID, 64) ?? str(src.shortId, 64);
  const metadata = (src.metadata && typeof src.metadata === 'object' ? src.metadata : {}) as Record<string, unknown>;
  const title = str(src.title, 500) ?? str(metadata.value, 500) ?? str(metadata.type, 500) ?? str(src.message, 500) ?? 'Sentry issue';
  const culprit = str(src.culprit, 300);
  const level = str(src.level, 32);
  const count = num(src.count);
  // Only accept https permalinks — a javascript:/data: URL would otherwise be stored and
  // rendered as an <a href> in the UI and outbound notifications (stored-XSS / phishing).
  const permalinkRaw = str(src.web_url, 2048) ?? str(src.permalink, 2048) ?? str(src.url, 2048);
  const permalink = permalinkRaw && /^https:\/\//i.test(permalinkRaw) ? permalinkRaw : null;
  const status = str(src.status, 32);
  const isResolved = action === 'resolved' || action === 'ignored' || status === 'resolved' || status === 'ignored';

  return {
    issueId,
    projectSlug,
    projectName,
    title,
    culprit,
    level,
    severity: levelToSeverity(level),
    count,
    permalink,
    action,
    isResolved,
  };
}
