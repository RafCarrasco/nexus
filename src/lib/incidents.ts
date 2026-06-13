/**
 * Clean a list of incident ids coming from the client: keep non-empty strings,
 * dedupe, and cap to bound the resulting query. Pure — no DB.
 */
export function sanitizeIncidentIds(input: unknown, max = 200): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) seen.add(s);
    }
    if (seen.size >= max) break;
  }
  return [...seen];
}
