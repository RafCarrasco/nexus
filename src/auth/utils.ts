/**
 * Pure utility — no NextAuth runtime import.
 * Exported from config.ts too for convenience.
 */

/** Procurement Garage corporate domains — the only ones allowed to sign in. */
const PG_DOMAINS = ['procurementgarage.com', 'pgconsulting-group.com'];

/**
 * The allowed email domains. Defaults to the two PG domains so the app is
 * PG-only out of the box (fail-closed to PG, not "nobody"). Override with the
 * comma-separated `NEXUS_ALLOWED_EMAIL_DOMAINS` env var if ever needed.
 */
export function allowedDomains(): string[] {
  const override = (process.env.NEXUS_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return override.length ? override : PG_DOMAINS;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return allowedDomains().some((d) => e.endsWith(`@${d}`));
}

/**
 * Dev-login allowlist check: email must pass isAllowedEmail AND be in
 * the NEXUS_DEV_EMAILS comma-separated list.  Pure — no NextAuth import.
 */
export function isDevAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!isAllowedEmail(email)) return false;
  const allow = (process.env.NEXUS_DEV_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase().trim());
}

/**
 * Checks the shared dev password against NEXUS_DEV_PASSWORD.
 * If env is unset/empty → always pass (back-compat).
 * Uses timing-safe SHA-256 comparison to avoid length-based leaks.
 */
export function checkDevPassword(submitted: string | null | undefined): boolean {
  const expected = process.env.NEXUS_DEV_PASSWORD ?? '';
  if (!expected) return true;
  if (!submitted) return false;
  const { createHash, timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(submitted).digest();
  return timingSafeEqual(a, b);
}
