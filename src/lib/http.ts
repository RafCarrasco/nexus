/**
 * Shared HTTP helpers for providers. Every outbound provider call should use
 * fetchWithTimeout so a hung/slow upstream can't stall the collector's per-connection
 * lock window. External health probes (HEAD to a hostname from an API response) should
 * additionally pass through isSafePublicHttpUrl to avoid SSRF into internal ranges.
 */

/** fetch with a hard timeout (default 10s). */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/**
 * True when `raw` is a public http(s) URL safe to probe. Rejects non-http(s) schemes and
 * loopback / link-local / private / metadata hosts. Custom public domains are allowed.
 */
export function isSafePublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  // IPv6: URL.hostname keeps the surrounding brackets for IPv6 literals. Strip them (and
  // any %zone id), then block loopback (::1), unspecified (::), unique-local (fc00::/7),
  // link-local (fe80::/10) and IPv4-mapped (::ffff:a.b.c.d, a known SSRF-bypass vector).
  // Guard on the ':' so plain public domains like "fc-foo.com" can never match.
  const ip6 = h.startsWith('[') ? h.slice(1, -1) : h;
  if (ip6.includes(':')) {
    const a = ip6.replace(/%.*$/, '');
    if (a === '::1' || a === '::') return false;
    if (/^(fc|fd)/.test(a)) return false; // unique-local fc00::/7
    if (/^fe[89ab]/.test(a)) return false; // link-local fe80::/10
    if (/^::ffff:/.test(a)) return false; // IPv4-mapped
  }
  return true;
}

/**
 * HEAD-probe an external URL safely: returns 'ok' (2xx), 'degraded' (non-2xx or error),
 * or 'unknown' when the URL is missing/unsafe. Centralizes the pattern repeated across
 * hosting/app-service providers.
 */
export async function probePublicUrl(
  rawUrl: string | undefined | null,
  ms = 10000,
): Promise<{ status: 'ok' | 'degraded' | 'unknown'; message?: string }> {
  if (!rawUrl) return { status: 'unknown', message: 'no url' };
  if (!isSafePublicHttpUrl(rawUrl)) return { status: 'unknown', message: 'unsafe url' };
  try {
    const res = await fetchWithTimeout(rawUrl, { method: 'HEAD' }, ms);
    return res.ok ? { status: 'ok' } : { status: 'degraded', message: `http ${res.status}` };
  } catch (e) {
    return { status: 'degraded', message: (e as Error).message };
  }
}

/**
 * Uptime probe: GET/HEAD a public URL and report up (status < 400) or down, with the
 * status code or network error. Same SSRF guard as probePublicUrl.
 */
export async function probeUptimeUrl(
  rawUrl: string,
  method: 'GET' | 'HEAD' = 'GET',
  ms = 10000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isSafePublicHttpUrl(rawUrl)) return { ok: false, error: 'unsafe url' };
  try {
    const res = await fetchWithTimeout(rawUrl, { method }, ms);
    return res.status < 400
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, error: `http ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
