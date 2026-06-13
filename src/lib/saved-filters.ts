/**
 * Pure helpers for the "Saved Filters" feature. No DB, no React — safe to import
 * from both server actions, server components, client components, and unit tests.
 *
 * A saved filter is a named snapshot of a page's URL searchParams, scoped to a
 * single page and a single user. Only an allow-listed set of params is persisted
 * per page so a malicious/garbage payload can never smuggle arbitrary keys into a
 * URL we later push the user to.
 */

/** Pages that support saved filters. `cost` is deferred (its filter is client useState, not URL-backed). */
export const SAVED_FILTER_PAGES = ['resources', 'incidents'] as const;
export type SavedFilterPage = (typeof SAVED_FILTER_PAGES)[number];

/** The exact searchParam keys each page reads. Anything else is dropped on save. */
export const ALLOWED_PARAMS: Record<string, string[]> = {
  resources: ['client', 'type', 'q'],
  incidents: ['severity', 'type'],
};

/** Max length of any single persisted value (defensive cap). */
const MAX_VALUE_LENGTH = 80;

export function isValidPage(p: unknown): p is SavedFilterPage {
  return typeof p === 'string' && (SAVED_FILTER_PAGES as readonly string[]).includes(p);
}

/**
 * Keep only the keys allow-listed for `page`, coerce each value to a non-empty
 * trimmed string, cap its length, and return the object with keys sorted so the
 * persisted shape is stable (deterministic equality + dedupe-friendly).
 */
export function sanitizeQuery(page: string, raw: Record<string, unknown>): Record<string, string> {
  const allowed = ALLOWED_PARAMS[page];
  if (!allowed || raw == null || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const key of [...allowed].sort()) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    out[key] = s.slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

/** Encode a sanitized query object as a URLSearchParams query string (keys already sorted). */
export function queryToSearchString(query: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, v);
  return params.toString();
}
