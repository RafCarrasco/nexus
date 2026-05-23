/**
 * Pure utility — no NextAuth runtime import.
 * Exported from config.ts too for convenience.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = (process.env.NEXUS_ALLOWED_EMAIL_DOMAIN ?? '').toLowerCase();
  if (!domain) return false;
  return email.toLowerCase().endsWith(`@${domain}`);
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
