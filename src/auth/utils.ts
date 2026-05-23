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
