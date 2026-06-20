import { createHash, randomBytes } from 'node:crypto';

/**
 * Ingest-token helpers. Tokens are 32 random bytes (high entropy), so an
 * unsalted SHA-256 is sufficient: there's nothing to brute-force and the
 * single deterministic hash keeps lookup O(1) via the unique tokenHash index.
 * NEVER log or persist the raw token — only its hash is stored.
 *
 * nodejs runtime only (node:crypto). Import solely from nodejs-runtime routes.
 */

/** sha256 hex of the raw token. Deterministic — used for both store and lookup. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Generate a fresh ingest token: `nx_` + 32 random bytes, base64url-encoded. */
export function generateToken(): string {
  return 'nx_' + randomBytes(32).toString('base64url');
}
