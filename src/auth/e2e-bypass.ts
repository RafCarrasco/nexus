/**
 * E2E auth bypass for Playwright. Two independent locks, both required:
 *   1. NEXUS_E2E === '1'                          (feature flag — never set in prod)
 *   2. x-nexus-e2e header === NEXUS_E2E_SECRET    (shared secret, timing-safe)
 *
 * Fail-closed: if NEXUS_E2E_SECRET is unset/empty, the bypass is OFF even when
 * NEXUS_E2E=1. So a misconfigured prod (flag accidentally on, no secret) still
 * can't be coerced into an admin session by a known static header value.
 *
 * This module is imported by middleware.ts (Edge runtime), so the constant-time
 * compare is hand-rolled in pure JS — node:crypto's timingSafeEqual isn't
 * available on Edge.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function e2eSession(req: Request): { user: { id: string; email: string; role: 'admin' } } | null {
  if (process.env.NEXUS_E2E !== '1') return null;
  const secret = process.env.NEXUS_E2E_SECRET;
  if (!secret) return null; // fail-closed: no secret configured → no bypass
  const provided = req.headers.get('x-nexus-e2e');
  if (!provided || !safeEqual(provided, secret)) return null;
  return { user: { id: 'e2e-admin', email: 'e2e@procurementgarage.com', role: 'admin' } };
}
